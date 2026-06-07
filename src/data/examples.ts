export const SAMPLE_JSON = `[
  {
    "order_id": "ORD-1001",
    "customer": {
      "id": "CUST-001",
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "address": {
        "street": "123 Maple Street",
        "city": "Springfield",
        "zipcode": "62701",
        "country": "USA"
      }
    },
    "items": [
      {
        "sku": "LAP-123",
        "name": "UltraBook Pro X1",
        "quantity": 1,
        "unit_price": 1299.99,
        "discount": 50.00,
        "details": {
          "weight_kg": 1.2,
          "color": "Space Gray"
        }
      },
      {
        "sku": "MOU-456",
        "name": "ErgoFit Wireless Mouse",
        "quantity": 2,
        "unit_price": 39.99,
        "discount": 0,
        "details": {
          "weight_kg": 0.09,
          "color": "Black"
        }
      }
    ],
    "order_date": "2025-06-01T09:30:00Z",
    "status": "shipped",
    "payment": {
      "method": "credit_card",
      "card_type": "Visa",
      "last4": "1234",
      "total_paid": 1429.97
    },
    "tags": ["priority", "gift-wrap"]
  },
  {
    "order_id": "ORD-1002",
    "customer": {
      "id": "CUST-002",
      "name": "Mike Johnson",
      "email": "mike.johnson@example.net",
      "address": {
        "street": "456 Oak Avenue",
        "city": "Metropolis",
        "zipcode": "85001",
        "country": "USA"
      }
    },
    "items": [
      {
        "sku": "MON-789",
        "name": "Quantum UHD Monitor 32\"",
        "quantity": 1,
        "unit_price": 549.00,
        "discount": 20.00,
        "details": {
          "weight_kg": 5.6,
          "color": "Silver"
        }
      }
    ],
    "order_date": "2025-06-03T14:15:00Z",
    "status": "processing",
    "payment": {
      "method": "paypal",
      "card_type": null,
      "last4": null,
      "total_paid": 529.00
    },
    "tags": ["backorder", "monitor"]
  },
  {
    "order_id": "ORD-1003",
    "customer": {
      "id": "CUST-003",
      "name": "Aisha Khan",
      "email": "aisha.khan@email.co.uk",
      "address": {
        "street": "789 Pine Road",
        "city": "London",
        "zipcode": "EC1A 1BB",
        "country": "UK"
      }
    },
    "items": [
      {
        "sku": "LAP-123",
        "name": "UltraBook Pro X1",
        "quantity": 1,
        "unit_price": 1299.99,
        "discount": 100.00,
        "details": {
          "weight_kg": 1.2,
          "color": "Silver"
        }
      },
      {
        "sku": "BAG-999",
        "name": "Leather Laptop Bag",
        "quantity": 1,
        "unit_price": 79.99,
        "discount": 0,
        "details": {
          "weight_kg": 0.8,
          "color": "Brown"
        }
      }
    ],
    "order_date": "2025-06-05T08:00:00Z",
    "status": "delivered",
    "payment": {
      "method": "gift_card",
      "card_type": null,
      "last4": null,
      "total_paid": 1279.98
    },
    "tags": ["express-shipping", "fragile"]
  }
]`

export const SAMPLE_MARKDOWN = `# JSON Viewer Notes

This panel supports **GitHub Flavored Markdown**, syntax highlighting, and Mermaid diagrams.

## Features

- Tree inspection
- Monaco raw editor
- Meld-style diff viewer
- Search across text, regex, filter, and JSONPath modes

\`\`\`ts
const status = { repaired: true, fixes: 4 }
// console.log(status) (removed to avoid console noise in demos)
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Upload JSON] --> B[Repair + Parse]
  B --> C[Tree View]
  B --> D[Diff View]
  D --> E[Export JSON Patch]
\`\`\`
`
