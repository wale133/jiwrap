export type Product = { id: number; name: string; category: string; price: number; unit: string; image: string; tag?: string };

export const categories = [
  { name: 'Packaging Boxes', detail: 'Boxes made for a memorable unboxing', image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=900&q=85' },
  { name: 'Paper Bags', detail: 'Branded bags for retail and gifting', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85' },
  { name: 'Labels & Stickers', detail: 'The finishing touch for your products', image: 'https://images.unsplash.com/photo-1634942536790-253d7f2b3c1b?auto=format&fit=crop&w=900&q=85' },
  { name: 'Business Printing', detail: 'Cards, flyers and everyday essentials', image: 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=900&q=85' },
  { name: 'Pouches', detail: 'Flexible packaging for products', image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=85' },
  { name: 'Corporate Gifts', detail: 'Thoughtful branded merchandise', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=85' },
];

export const products: Product[] = [
  { id: 1, name: 'Custom Rigid Gift Box', category: 'Packaging Boxes', price: 7500, unit: 'per box', image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=900&q=85', tag: 'Bestseller' },
  { id: 2, name: 'Branded Paper Shopping Bag', category: 'Paper Bags', price: 1200, unit: 'per bag', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85' },
  { id: 3, name: 'Custom Product Labels', category: 'Labels & Stickers', price: 8000, unit: 'per roll', image: 'https://images.unsplash.com/photo-1634942536790-253d7f2b3c1b?auto=format&fit=crop&w=900&q=85' },
  { id: 4, name: 'Branded Business Cards', category: 'Business Printing', price: 5000, unit: 'per 100', image: 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=900&q=85' },
  { id: 5, name: 'Custom Stand-up Pouch', category: 'Pouches', price: 2500, unit: 'per pouch', image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=85' },
  { id: 6, name: 'Branded Gift Set', category: 'Corporate Gifts', price: 9500, unit: 'per set', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=85', tag: 'Popular' },
];
