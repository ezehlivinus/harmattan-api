CREATE TYPE "public"."account_type" AS ENUM('WALLET', 'EXTERNAL_SETTLEMENT', 'FX_POOL');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('cNGN', 'cGHS', 'cXAF', 'USDx', 'EURx');--> statement-breakpoint
CREATE TYPE "public"."rate_source" AS ENUM('LIVE', 'CACHED', 'FALLBACK');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('DEPOSIT', 'SWAP', 'TRANSFER');--> statement-breakpoint
CREATE TABLE "balances" (
	"wallet_id" uuid NOT NULL,
	"currency" "currency" NOT NULL,
	"amount" numeric(38, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balances_pkey" PRIMARY KEY("wallet_id","currency"),
	CONSTRAINT "balances_amount_non_negative" CHECK ("balances"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"currency" "currency" PRIMARY KEY NOT NULL,
	"units_per_usd" numeric(38, 18) NOT NULL,
	"source" "rate_source" NOT NULL,
	"fetched_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "fx_rates_units_per_usd_positive" CHECK ("fx_rates"."units_per_usd" > 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY("scope","key"),
	CONSTRAINT "idempotency_keys_key_length" CHECK (char_length("idempotency_keys"."key") BETWEEN 1 AND 255),
	CONSTRAINT "idempotency_keys_request_hash_format" CHECK ("idempotency_keys"."request_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_type" "account_type" NOT NULL,
	"wallet_id" uuid,
	"currency" "currency" NOT NULL,
	"amount" numeric(38, 6) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amount_non_zero" CHECK ("ledger_entries"."amount" <> 0),
	CONSTRAINT "ledger_entries_account_check" CHECK (("ledger_entries"."account_type" = 'WALLET') = ("ledger_entries"."wallet_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "transaction_type" NOT NULL,
	"source_wallet_id" uuid,
	"destination_wallet_id" uuid NOT NULL,
	"source_amount" numeric(38, 6) NOT NULL,
	"source_currency" "currency" NOT NULL,
	"destination_amount" numeric(38, 6) NOT NULL,
	"destination_currency" "currency" NOT NULL,
	"rate" numeric(38, 18) NOT NULL,
	"rate_source" "rate_source",
	"rate_fetched_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_source_amount_positive" CHECK ("transactions"."source_amount" > 0),
	CONSTRAINT "transactions_destination_amount_positive" CHECK ("transactions"."destination_amount" > 0),
	CONSTRAINT "transactions_rate_positive" CHECK ("transactions"."rate" > 0),
	CONSTRAINT "transactions_shape_check" CHECK (("transactions"."type" = 'DEPOSIT' AND "transactions"."source_wallet_id" IS NULL
            AND "transactions"."source_currency" = "transactions"."destination_currency"
            AND "transactions"."source_amount" = "transactions"."destination_amount")
       OR ("transactions"."type" = 'SWAP' AND "transactions"."source_wallet_id" IS NOT NULL
            AND "transactions"."source_wallet_id" = "transactions"."destination_wallet_id"
            AND "transactions"."source_currency" <> "transactions"."destination_currency")
       OR ("transactions"."type" = 'TRANSFER' AND "transactions"."source_wallet_id" IS NOT NULL
            AND "transactions"."source_wallet_id" <> "transactions"."destination_wallet_id")),
	CONSTRAINT "transactions_rate_check" CHECK (("transactions"."source_currency" = "transactions"."destination_currency" AND "transactions"."rate" = 1
            AND "transactions"."rate_source" IS NULL AND "transactions"."rate_fetched_at" IS NULL)
       OR ("transactions"."source_currency" <> "transactions"."destination_currency"
            AND "transactions"."rate_source" IS NOT NULL AND "transactions"."rate_fetched_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_contact_check" CHECK ("wallets"."email" IS NOT NULL OR "wallets"."phone" IS NOT NULL),
	CONSTRAINT "wallets_email_normalized" CHECK ("wallets"."email" = lower(btrim("wallets"."email"))),
	CONSTRAINT "wallets_phone_e164" CHECK ("wallets"."phone" ~ '^[+][1-9][0-9]{6,14}$')
);
--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_wallet_id_wallets_id_fk" FOREIGN KEY ("source_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_wallet_id_wallets_id_fk" FOREIGN KEY ("destination_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_wallet_currency_idx" ON "ledger_entries" USING btree ("wallet_id","currency");--> statement-breakpoint
CREATE INDEX "transactions_source_wallet_history_idx" ON "transactions" USING btree ("source_wallet_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "transactions_destination_wallet_history_idx" ON "transactions" USING btree ("destination_wallet_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_email_unique" ON "wallets" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_phone_unique" ON "wallets" USING btree ("phone");