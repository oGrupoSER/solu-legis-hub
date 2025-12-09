-- Add confirm_receipt flag to partner_services
ALTER TABLE public.partner_services 
ADD COLUMN confirm_receipt boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.partner_services.confirm_receipt IS 'Se true, o sistema confirma recebimento na Solucionare. Manter false enquanto sistema legado estiver ativo.';