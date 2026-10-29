import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { FxModule } from './modules/fx/fx.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { WalletsModule } from './modules/wallets/wallets.module.js';
import { ClockModule } from './shared/infrastructure/clock/clock.module.js';
import { AppConfigModule } from './shared/infrastructure/config/config.module.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { HealthModule } from './shared/infrastructure/health/health.module.js';
import { ApiHttpModule } from './shared/infrastructure/http/http.module.js';

@Module({
  imports: [
    AppConfigModule,
    ClockModule,
    DatabaseModule,
    CqrsModule.forRoot(),
    ApiHttpModule,
    HealthModule,
    WalletsModule,
    FxModule,
    PaymentsModule,
    TransactionsModule,
  ],
})
export class AppModule {}
