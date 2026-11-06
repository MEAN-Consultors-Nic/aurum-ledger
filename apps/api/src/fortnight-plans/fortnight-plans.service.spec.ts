/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest mocks of Mongoose models */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FortnightPlansService } from './fortnight-plans.service';

/**
 * The money-moving contract of the planner: a line is claimed atomically
 * before anything is written, released when the movement fails, and never
 * executed twice.
 */
describe('FortnightPlansService — apply', () => {
  const planId = new Types.ObjectId();
  const lineId = new Types.ObjectId();
  const usdAccount = { _id: new Types.ObjectId(), currency: 'USD' };
  const nioAccount = { _id: new Types.ObjectId(), currency: 'NIO' };
  const categoryId = new Types.ObjectId();

  let plan: any;
  let planModel: any;
  let transactionsService: any;
  let accountsService: any;
  let sources: any;
  let service: FortnightPlansService;

  const manualLine = (overrides: Record<string, unknown> = {}) => ({
    _id: lineId,
    kind: 'expense',
    source: 'manual',
    name: 'Colegio',
    plannedAmount: 1825,
    currency: 'NIO',
    categoryId,
    accountId: usdAccount._id,
    status: 'planned',
    order: 1,
    repeat: false,
    unplanned: false,
    amountOverridden: false,
    ...overrides,
  });

  beforeEach(() => {
    plan = {
      _id: planId,
      periodKey: '2026-11-1',
      status: 'open',
      startDate: new Date(2026, 10, 1),
      endDate: new Date(2026, 10, 15, 23, 59, 59, 999),
      lines: [manualLine()],
    };
    planModel = {
      findOne: jest.fn(() => ({ lean: () => Promise.resolve(plan) })),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: planId }),
      updateOne: jest
        .fn()
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    };
    transactionsService = {
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      createTransfer: jest.fn(),
    };
    accountsService = {
      findById: jest.fn((id: string) =>
        Promise.resolve(
          id === nioAccount._id.toString() ? nioAccount : usdAccount,
        ),
      ),
    };
    sources = {
      reactivateIfOmitted: jest.fn().mockResolvedValue(false),
      confirm: jest
        .fn()
        .mockResolvedValue({ transactionId: new Types.ObjectId() }),
    };
    const settingsService = { getNumber: jest.fn().mockResolvedValue(36.5) };
    const config = { get: jest.fn() };

    service = new FortnightPlansService(
      planModel,
      {} as any,
      {} as any,
      sources,
      accountsService,
      transactionsService,
      {} as any,
      settingsService as any,
      config as any,
    );
    jest
      .spyOn(service as any, 'getDetailFresh')
      .mockResolvedValue({ ok: true });
  });

  it('records a córdoba obligation paid from a dollar account in dollars, linked to the line', async () => {
    await service.applyLine('2026-11-1', lineId.toString(), {
      date: '2026-11-05',
    });

    expect(planModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: { $elemMatch: { _id: lineId, status: 'planned' } },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ 'lines.$.status': 'applying' }),
      }),
      expect.anything(),
    );
    const [dto, , links] = transactionsService.create.mock.calls[0];
    expect(dto).toMatchObject({
      type: 'expense',
      amount: 50,
      currency: 'USD',
      exchangeRate: 36.5,
    });
    expect(links).toEqual({ planLineId: lineId });

    const finalUpdate = planModel.updateOne.mock.calls[0][1].$set;
    expect(finalUpdate).toMatchObject({
      'lines.$.status': 'applied',
      'lines.$.appliedAmount': 1825,
      'lines.$.appliedAccountAmount': 50,
      'lines.$.appliedAccountCurrency': 'USD',
    });
  });

  it('refuses a second apply without touching the books', async () => {
    planModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.applyLine('2026-11-1', lineId.toString(), {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transactionsService.create).not.toHaveBeenCalled();
  });

  it('refuses lines that are no longer planned', async () => {
    plan.lines = [manualLine({ status: 'applied' })];
    await expect(
      service.applyLine('2026-11-1', lineId.toString(), {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(planModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('releases the claim when the movement fails', async () => {
    transactionsService.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.applyLine('2026-11-1', lineId.toString(), {}),
    ).rejects.toThrow('db down');
    expect(planModel.updateOne).toHaveBeenCalledWith(
      {
        _id: planId,
        lines: { $elemMatch: { _id: lineId, status: 'applying' } },
      },
      {
        $set: { 'lines.$.status': 'planned' },
        $unset: { 'lines.$.applyStartedAt': '' },
      },
    );
  });

  it('validates before claiming, so bad input leaves nothing behind', async () => {
    plan.lines = [manualLine({ accountId: undefined })];
    await expect(
      service.applyLine('2026-11-1', lineId.toString(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(planModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('hands loan payments to the loans module with the real amount and date', async () => {
    const occurrenceId = new Types.ObjectId();
    plan.lines = [
      manualLine({
        source: 'loan',
        sourceOccurrenceId: occurrenceId,
        currency: 'USD',
        plannedAmount: 250,
        name: 'Carro',
      }),
    ];

    await service.applyLine('2026-11-1', lineId.toString(), {
      amount: 300,
      date: '2026-11-04',
    });

    expect(sources.confirm).toHaveBeenCalledWith(
      'loan',
      occurrenceId,
      { amount: 300, date: new Date(2026, 10, 4), note: undefined },
      undefined,
    );
    expect(transactionsService.create).not.toHaveBeenCalled();
  });

  it('does not let the planner change the paying account of a loan', async () => {
    plan.lines = [
      manualLine({
        source: 'loan',
        sourceOccurrenceId: new Types.ObjectId(),
        currency: 'USD',
      }),
    ];
    await expect(
      service.applyLine('2026-11-1', lineId.toString(), {
        accountId: nioAccount._id.toString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sources.confirm).not.toHaveBeenCalled();
  });

  it('keeps the unpaid part of a manual line as a new planned line when asked', async () => {
    plan.lines = [manualLine({ currency: 'USD', plannedAmount: 300 })];

    await service.applyLine('2026-11-1', lineId.toString(), {
      amount: 120,
      keepRemainder: true,
    });

    const push = planModel.updateOne.mock.calls.find(
      (call: any[]) => call[1].$push,
    )?.[1].$push.lines;
    expect(push).toMatchObject({
      name: 'Colegio (remainder)',
      plannedAmount: 180,
      status: 'planned',
    });
  });
});
