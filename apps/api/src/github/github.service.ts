import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

const GITHUB_API = 'https://api.github.com';

export type GithubRepoCreated = {
  owner: string;
  name: string;
  htmlUrl: string;
  createdAt: string;
};

export type GithubCommitSummary = {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorAvatar?: string;
  url: string;
  date: string;
};

export type GithubPullRequestSummary = {
  number: number;
  title: string;
  authorName: string;
  state: 'open' | 'closed';
  draft: boolean;
  url: string;
  updatedAt: string;
};

export type GithubActivity = {
  commits: GithubCommitSummary[];
  pullRequests: GithubPullRequestSummary[];
  repoHtmlUrl: string;
  defaultBranch?: string;
  visibility?: 'public' | 'private' | 'internal';
};

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async isConfigured(): Promise<boolean> {
    const token = await this.settingsService.getGithubAccessToken();
    return !!token;
  }

  /**
   * Parses a repo URL or "owner/name" string into { owner, name }.
   * Returns null if it doesn't look like a GitHub repo reference.
   */
  parseRepoRef(input: string): { owner: string; name: string } | null {
    if (!input) return null;
    const trimmed = input.trim();
    // owner/name shorthand
    const shorthand = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (shorthand) {
      return { owner: shorthand[1], name: shorthand[2] };
    }
    // Full URL
    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
        return null;
      }
      const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
      if (parts.length < 2) return null;
      const owner = parts[0];
      const name = parts[1].replace(/\.git$/, '');
      if (!owner || !name) return null;
      return { owner, name };
    } catch {
      return null;
    }
  }

  /** Sluggify a name: lowercase, alphanumeric + hyphens. */
  slug(input: string): string {
    return (input || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  async createRepository(input: {
    name: string;
    description?: string;
    privateRepo?: boolean;
  }): Promise<GithubRepoCreated> {
    const token = await this.requireToken();
    const { org } = await this.settingsService.getGithubSettings();
    const settings = await this.settingsService.getGithubSettings();
    const isPrivate = input.privateRepo ?? settings.defaultPrivate;

    const endpoint = org
      ? `${GITHUB_API}/orgs/${encodeURIComponent(org)}/repos`
      : `${GITHUB_API}/user/repos`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        private: isPrivate,
        auto_init: true,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      throw new UnauthorizedException(
        'GitHub rejected the access token. Check it has repo scope and write access for the org.',
      );
    }
    if (res.status === 422) {
      const body = await this.safeJson(res);
      const message = body?.errors?.[0]?.message ?? 'Repository name may already exist.';
      throw new BadRequestException(`GitHub: ${message}`);
    }
    if (!res.ok) {
      throw new BadGatewayException(`GitHub API error: ${res.status}`);
    }

    const body = (await res.json()) as {
      owner: { login: string };
      name: string;
      html_url: string;
      created_at: string;
    };
    return {
      owner: body.owner.login,
      name: body.name,
      htmlUrl: body.html_url,
      createdAt: body.created_at,
    };
  }

  async getActivity(owner: string, repo: string): Promise<GithubActivity> {
    const token = await this.requireToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const [repoRes, commitsRes, prsRes] = await Promise.all([
      fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers }),
      fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=5`, { headers }),
      fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&per_page=10`, { headers }),
    ]);

    if (repoRes.status === 404) {
      throw new BadRequestException('Repository not found. It may have been renamed or removed.');
    }
    if (repoRes.status === 401 || repoRes.status === 403) {
      throw new UnauthorizedException('GitHub rejected the access token.');
    }
    if (!repoRes.ok) {
      throw new BadGatewayException(`GitHub API error: ${repoRes.status}`);
    }

    const repoBody = (await repoRes.json()) as {
      html_url: string;
      default_branch?: string;
      visibility?: string;
      private: boolean;
    };

    const commits: GithubCommitSummary[] = commitsRes.ok
      ? (await commitsRes.json()).map((c: any) => ({
          sha: c.sha,
          shortSha: String(c.sha).slice(0, 7),
          message: this.firstLine(c.commit?.message ?? ''),
          authorName: c.commit?.author?.name ?? c.author?.login ?? 'Unknown',
          authorAvatar: c.author?.avatar_url,
          url: c.html_url,
          date: c.commit?.author?.date ?? c.commit?.committer?.date ?? '',
        }))
      : [];

    const pullRequests: GithubPullRequestSummary[] = prsRes.ok
      ? (await prsRes.json()).map((p: any) => ({
          number: p.number,
          title: p.title,
          authorName: p.user?.login ?? 'unknown',
          state: p.state,
          draft: !!p.draft,
          url: p.html_url,
          updatedAt: p.updated_at,
        }))
      : [];

    return {
      commits,
      pullRequests,
      repoHtmlUrl: repoBody.html_url,
      defaultBranch: repoBody.default_branch,
      visibility: (repoBody.visibility as 'public' | 'private' | 'internal') ??
        (repoBody.private ? 'private' : 'public'),
    };
  }

  private async requireToken(): Promise<string> {
    const token = await this.settingsService.getGithubAccessToken();
    if (!token) {
      throw new BadRequestException(
        'GitHub is not configured. Add a Personal Access Token in Settings → GitHub.',
      );
    }
    return token;
  }

  private firstLine(s: string): string {
    return s.split('\n')[0].slice(0, 200);
  }

  private async safeJson(res: Response): Promise<any> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}
