import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CURRENCIES } from '../../../../../shared/domain/currency.js';
import { FX_RATES, type FxRatesPort } from '../../fx-rates.port.js';
import { GetRatesQuery, type RatesView } from './get-rates.query.js';

/** Required by the provider's terms wherever its rates are shown. */
const ATTRIBUTION = { text: 'Rates By Exchange Rate API', url: 'https://www.exchangerate-api.com' };

@QueryHandler(GetRatesQuery)
export class GetRatesHandler implements IQueryHandler<GetRatesQuery> {
  constructor(@Inject(FX_RATES) private readonly fx: FxRatesPort) {}

  async execute(): Promise<RatesView> {
    const table = await this.fx.current();
    const fetchedAt = table.fetchedAt.toISOString();
    return {
      source: table.source,
      fetchedAt,
      attribution: ATTRIBUTION,
      rates: CURRENCIES.flatMap((from) =>
        CURRENCIES.map((to) => ({
          from,
          to,
          rate: table.rate(from, to),
          source: table.source,
          fetchedAt,
        })),
      ),
    };
  }
}
