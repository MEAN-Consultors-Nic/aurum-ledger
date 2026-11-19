import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Contract } from '../contracts/schemas/contract.schema';
import { FortnightPlan } from '../fortnight-plans/schemas/fortnight-plan.schema';
import { PlannedIncomeOccurrence } from '../planned-incomes/schemas/planned-income-occurrence.schema';
import { Project } from '../projects/schemas/project.schema';
import { ProjectTask } from '../projects/schemas/project-task.schema';
import { SettingsService } from '../settings/settings.service';
import { NotificationsEngineService } from './notifications-engine.service';
import { NotificationsSchedulerService } from './notifications-scheduler.service';

describe('NotificationsSchedulerService — carried-over reminders', () => {
  const dispatch = jest.fn().mockResolvedValue(undefined);
  const lean = jest.fn();
  const find = jest.fn().mockReturnValue({ lean });
  let service: NotificationsSchedulerService;

  const carried = (name: string, amount: number) => ({
    name,
    plannedAmount: amount,
    currency: 'USD',
    kind: 'expense',
    status: 'planned',
    dueDate: new Date(2026, 10, 13),
    carriedFromPeriod: '2026-11-1',
    unplanned: false,
  });

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 18, 12));
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationsSchedulerService,
        ...[
          Contract.name,
          Project.name,
          ProjectTask.name,
          PlannedIncomeOccurrence.name,
        ].map((name) => ({ provide: getModelToken(name), useValue: {} })),
        { provide: getModelToken(FortnightPlan.name), useValue: { find } },
        { provide: NotificationsEngineService, useValue: { dispatch } },
        {
          provide: SettingsService,
          useValue: { getNumber: jest.fn().mockResolvedValue(36.5) },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(NotificationsSchedulerService);
  });

  afterEach(() => jest.useRealTimers());

  it('does not send a digest when only carried-over payments are overdue', async () => {
    // Return the document even if Mongo would now filter it out, to exercise
    // the per-line filter as well as the database predicate.
    lean.mockResolvedValue([
      {
        periodKey: '2026-11-2',
        lines: [carried('Meyling', 110), carried('Cuato moto', 180)],
      },
    ]);

    await service['runFortnightLinesOverdue']();

    expect(dispatch).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledWith({
      status: 'open',
      lines: {
        $elemMatch: {
          status: 'planned',
          dueDate: { $lt: new Date(2026, 10, 18) },
          carriedFromPeriod: { $in: [null, ''] },
        },
      },
    });
  });

  it('excludes carried amounts from a mixed digest but still notifies normal overdue payments', async () => {
    const normal = {
      name: 'Internet',
      plannedAmount: 365,
      currency: 'NIO',
      kind: 'expense',
      status: 'planned',
      dueDate: new Date(2026, 10, 17),
      unplanned: false,
    };
    lean.mockResolvedValue([
      {
        periodKey: '2026-11-2',
        lines: [
          carried('Meyling', 110),
          carried('Cuato moto', 180),
          normal,
          { ...normal, name: 'Paid', status: 'applied' },
          { ...normal, name: 'Future', dueDate: new Date(2026, 10, 25) },
          { ...normal, name: 'Unplanned', unplanned: true },
          { ...normal, name: 'Income', kind: 'income' },
        ],
      },
    ]);

    await service['runFortnightLinesOverdue']();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      eventKey: 'fortnight.lines_overdue',
      contextRef: 'fortnight:2026-11-2',
      dedupeKey: 'fortnight.lines_overdue:2026-11-2:2026-11-18',
      context: {
        period: { key: '2026-11-2', label: 'Nov 16–30, 2026' },
        count: 1,
        items: [
          {
            name: 'Internet',
            amount: 365,
            currency: 'NIO',
            dueDate: normal.dueDate,
            kind: 'expense',
          },
        ],
        totalUsd: 10,
        totalNio: 365,
      },
    });
  });
});
