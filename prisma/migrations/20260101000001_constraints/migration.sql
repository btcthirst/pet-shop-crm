-- Extra constraints Prisma has no schema syntax for (spec section 4).
ALTER TABLE "Product" ADD CONSTRAINT product_stock_nonneg CHECK (stock >= 0);
ALTER TABLE "Product" ADD CONSTRAINT product_price_nonneg CHECK ("priceKopecks" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT orderitem_qty_positive CHECK (quantity > 0);