import { Module } from '@nestjs/common';
import {
  Command,
  CommandBus,
  CommandHandler,
  CqrsModule,
  ICommandHandler,
  IQueryHandler,
  Query,
  QueryBus,
  QueryHandler,
} from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';

class PingCommand extends Command<{ pong: string }> {
  constructor(readonly value: string) {
    super();
  }
}

@CommandHandler(PingCommand)
class PingHandler implements ICommandHandler<PingCommand> {
  async execute(command: PingCommand): Promise<{ pong: string }> {
    return await Promise.resolve({ pong: command.value });
  }
}

class CountQuery extends Query<number> {}

@QueryHandler(CountQuery)
class CountHandler implements IQueryHandler<CountQuery> {
  async execute(): Promise<number> {
    return await Promise.resolve(42);
  }
}

// Handlers live in a feature module, the buses come from the root CqrsModule.
@Module({ providers: [PingHandler, CountHandler] })
class FeatureModule {}

describe('CQRS wiring', () => {
  it('dispatches commands and queries to handlers registered in a feature module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CqrsModule.forRoot(), FeatureModule],
    }).compile();
    await moduleRef.init();

    const pong = await moduleRef.get(CommandBus).execute(new PingCommand('hi'));
    const count = await moduleRef.get(QueryBus).execute(new CountQuery());

    expect(pong).toEqual({ pong: 'hi' });
    expect(count).toBe(42);
    await moduleRef.close();
  });
});
