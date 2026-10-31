import { MeasurementItem, Project } from '../App';

export interface CalculatedBoqSummary {
  subtotal: number;
  vatAmount: number;
  contingencyAmount: number;
  discountAmount: number;
  grandTotal: number;
}

export function calculateProjectBoqTotals(project: Project): CalculatedBoqSummary {
  let subtotal = 0;
  
  project.items.forEach(item => {
    // If item has sub-divisions, sum them up
    let itemQty = item.qty;
    if (item.subDivisions && item.subDivisions.length > 0) {
      itemQty = item.subDivisions.reduce((acc, sub) => acc + (sub.qty * sub.length * sub.width * (sub.height || 1)), 0);
    }
    const wastageMultiplier = 1 + ((item.wastagePercent || project.wastageDefault || 0) / 100);
    const itemTotal = itemQty * item.unitRate * wastageMultiplier;
    subtotal += itemTotal;
  });

  const discountAmount = project.discountAmount || 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  
  const vatAmount = discountedSubtotal * ((project.vatPercent || 13) / 100);
  const contingencyAmount = discountedSubtotal * ((project.contingencyPercent || 5) / 100);
  
  const grandTotal = discountedSubtotal + vatAmount + contingencyAmount;

  return {
    subtotal,
    vatAmount,
    contingencyAmount,
    discountAmount,
    grandTotal
  };
}

export function formatCurrency(amount: number, currencySymbol: string = 'NPR'): string {
  return `${currencySymbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
