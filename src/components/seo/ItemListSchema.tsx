import { Helmet } from "react-helmet-async";

export interface ItemListSchemaItem {
  position: number;
  name: string;
  description: string;
}

interface Props {
  listName: string;
  listDescription: string;
  listUrl: string;
  items: ItemListSchemaItem[];
}

export default function ItemListSchema({ listName, listDescription, listUrl, items }: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": listName,
    "description": listDescription,
    "url": listUrl,
    "itemListElement": items.map((item) => ({
      "@type": "Product",
      "position": item.position,
      "name": item.name,
      "description": item.description,
      "brand": { "@type": "Brand", "name": "Nivra Telecom" },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "CAD",
        "availability": "https://schema.org/InStock",
        "seller": { "@type": "Organization", "name": "Nivra Telecom" },
      },
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
