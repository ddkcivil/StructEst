import { Project } from '../types';
import { DEFAULT_CATEGORY_MAPPINGS } from './../types';

export function ensureItemCategories(projectsList: Project[]): Project[] {
  return projectsList.map(proj => ({
    ...proj,
    items: proj.items.map(item => {
      let updatedItem = { ...item };
      if (
        (updatedItem.category === 'Civil Works' || !updatedItem.category) &&
        DEFAULT_CATEGORY_MAPPINGS[updatedItem.id]
      ) {
        updatedItem.category = DEFAULT_CATEGORY_MAPPINGS[updatedItem.id];
      }
      if (!updatedItem.subDivisions || updatedItem.subDivisions.length === 0) {
        if (updatedItem.id === 'item-2') {
          updatedItem.subDivisions = [
            { id: 'sub-2-1', description: 'Foundation Trench Excavation', qty: 1, length: 80.85, width: 1.50, height: 1.00 },
            { id: 'sub-2-2', description: 'For Compound Wall Excavation', qty: 1, length: 49.00, width: 0.60, height: 0.50 }
          ];
        } else if (updatedItem.id === 'item-9') {
          updatedItem.subDivisions = [
            { id: 'sub-9-1', description: 'Sub Structure - Vertical Side 1', qty: 4, length: 2.97, width: 0.23, height: 1.50 },
            { id: 'sub-9-2', description: 'Ground Floor - Partition Walls', qty: 1, length: 17.00, width: 0.23, height: 2.75 },
            { id: 'sub-9-3', description: 'First Floor - Vertical Side 1', qty: 3, length: 2.70, width: 0.23, height: 3.00 },
            { id: 'sub-9-4', description: 'Main Loadbearing Outer Walls Grid', qty: 1, length: 119.85, width: 0.23, height: 2.85 },
            { id: 'sub-9-5', description: 'Deductions (Doors & Windows)', qty: -1, length: 7.75, width: 0.23, height: 2.10 }
          ];
        }
      }
      return updatedItem;
    })
  }));
}
