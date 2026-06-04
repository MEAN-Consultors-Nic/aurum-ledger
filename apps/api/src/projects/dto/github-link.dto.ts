import { IsNotEmpty, IsString } from 'class-validator';

export class GithubLinkDto {
  @IsString()
  @IsNotEmpty()
  repoUrl: string;
}
