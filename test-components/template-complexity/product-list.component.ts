import { Component, OnInit } from '@angular/core';

interface Category {
  id: number;
  name: string;
  products: Product[];
}

interface Product {
  id: number;
  name: string;
  price: number;
  variants: Variant[];
}

interface Variant {
  id: number;
  color: string;
  size: string;
  stock: number;
}

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit {
  categories: Category[] = [];

  constructor() {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categories = [
      {
        id: 1,
        name: 'Electronics',
        products: [
          {
            id: 101,
            name: 'Laptop',
            price: 999,
            variants: [
              { id: 1, color: 'Silver', size: '13"', stock: 5 },
              { id: 2, color: 'Black', size: '15"', stock: 3 }
            ]
          }
        ]
      }
    ];
  }

  formatPrice(price: number): string {
    return `$${price.toFixed(2)}`;
  }

  calculateDiscount(price: number): number {
    return price * 0.9;
  }
}
