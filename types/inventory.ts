export interface RawSheetRow {
  rowIndex: number;
  date: string; 
  orderId: string;
  materialType: string;
  category: string;
  color: string;
  quantity: string;
}

export interface InventoryRecord {
  order_no: string;
  material_type: string;
  category: string;
  color: string;
  quantity: number;
  // material_cost: number;
}