-- Pagos en USDC por Solana (Solana Pay).
--
-- Reusa las columnas de `purchases` que ya existen para Mercado Pago:
--   provider           = 'solana'
--   provider_reference = clave pública de REFERENCIA de la compra (única)
--   provider_payment_id= firma de la transacción que la pagó
--   amount_cents       = precio en centavos de dólar (currency = 'USDC')
--
-- Una misma transacción no puede pagar dos compras: aunque alguien incluya
-- varias referencias en una sola transferencia, la firma sólo se acepta una vez.

create unique index if not exists purchases_solana_signature_uidx
  on public.purchases (provider_payment_id)
  where provider = 'solana' and provider_payment_id is not null;
