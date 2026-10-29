import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { currencyCode } from '../../../shared/infrastructure/http/schemas.js';
import { GetRatesQuery, type RatesView } from '../application/queries/get-rates/get-rates.query.js';

const source = z.enum(['LIVE', 'CACHED', 'FALLBACK']).meta({
  description:
    'LIVE: from the provider. CACHED: last good provider rates (provider unavailable). ' +
    'FALLBACK: built-in table (provider never reached).',
});
const fetchedAt = z.iso
  .datetime()
  .meta({ description: 'When the provider last refreshed the rates' });

const ratesResponse = z
  .object({
    source,
    fetchedAt,
    attribution: z.object({ text: z.string(), url: z.url() }),
    rates: z.array(
      z.object({
        from: currencyCode,
        to: currencyCode,
        rate: z.string().meta({ description: 'Units of `to` per 1 `from`, 18 decimals' }),
        source,
        fetchedAt,
      }),
    ),
  })
  .meta({ id: 'FxRates' });

@ApiTags('fx')
@Controller('fx/rates')
export class FxController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    summary: 'Current exchange rates between all supported stablecoins',
    description:
      'All 25 pairs (5×5, including 1 for the same currency). Each stablecoin is pegged 1:1 to ' +
      'its fiat currency. Rates come from open.er-api.com (refreshed daily, cached for up to ' +
      '1 hour); when the provider is unavailable the last good or built-in rates are returned ' +
      'and labelled by `source`.',
  })
  @ApiOkResponse({
    standardSchema: ratesResponse,
    example: {
      source: 'LIVE',
      fetchedAt: '2026-10-29T00:02:31.000Z',
      attribution: { text: 'Rates By Exchange Rate API', url: 'https://www.exchangerate-api.com' },
      rates: [
        {
          from: 'USDx',
          to: 'cNGN',
          rate: '1346.236888000000000000',
          source: 'LIVE',
          fetchedAt: '2026-10-29T00:02:31.000Z',
        },
        {
          from: 'cNGN',
          to: 'USDx',
          rate: '0.000742811320142640',
          source: 'LIVE',
          fetchedAt: '2026-10-29T00:02:31.000Z',
        },
      ],
    },
  })
  async rates(): Promise<RatesView> {
    return await this.queryBus.execute(new GetRatesQuery());
  }
}
