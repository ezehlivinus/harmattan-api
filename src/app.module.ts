import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { FxModule } from './modules/fx/fx.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { WalletsModule } from './modules/wallets/wallets.module.js';
import { AppConfigModule } from './shared/infrastructure/config/config.module.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { HealthModule } from './shared/infrastructure/health/health.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CqrsModule.forRoot(),
    HealthModule,
    WalletsModule,
    FxModule,
    PaymentsModule,
    TransactionsModule,
  ],
})
export class AppModule {}
