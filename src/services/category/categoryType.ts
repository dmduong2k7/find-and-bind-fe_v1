/**
 * Khớp Find_And_Bind_BE.src.Module.Category.CategoryDtos.
 * BE chưa cấu hình JsonStringEnumConverter nên enum đi/về dạng SỐ theo thứ tự khai báo.
 */
export enum CategoriesEnum {
  Food = 0,
  Travel = 1,
}

export interface CategoryDto {
  id: number;
  name: string;
  type: CategoriesEnum;
  locationCount: number;
}

/** Body cho POST /api/Category */
export interface CreateCategoryDto {
  name: string; // max 100
  type: CategoriesEnum;
}

/** Body cho PUT /api/Category/{id} */
export type UpdateCategoryDto = CreateCategoryDto;