import { Test, TestingModule } from '@nestjs/testing';
import { CashiersSessionController } from './cashiers-session.controller';

describe('CashiersSessionController', () => {
  let controller: CashiersSessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashiersSessionController],
    }).compile();

    controller = module.get<CashiersSessionController>(CashiersSessionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
