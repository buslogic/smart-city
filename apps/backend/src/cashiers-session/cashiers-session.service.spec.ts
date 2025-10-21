import { Test, TestingModule } from '@nestjs/testing';
import { CashiersSessionService } from './cashiers-session.service';

describe('CashiersSessionService', () => {
  let service: CashiersSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashiersSessionService],
    }).compile();

    service = module.get<CashiersSessionService>(CashiersSessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
