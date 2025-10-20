import { DogBreedWikiModel, DogBreedWikiDoc } from '../models/dogs_wiki.model';
import { ConflictError, NotFoundError } from '../errors';

// Các tùy chọn cho việc lấy danh sách
export interface QueryOptions {
  page: number;
  limit: number;
  search?: string;
  group?: string;
  energy_level?: number;
  trainability?: number;
  shedding_level?: number;
  suitable_for?: string;
  sort?: string;
  ids?: string[]; // Dùng để lọc các ID cụ thể
  excludeIds?: string[]; // Dùng để loại trừ các ID
}

export const wikiService = {
  /**
   * CREATE: Admin thêm một giống chó mới vào wiki
   */
  async createBreed(data: Partial<DogBreedWikiDoc>): Promise<DogBreedWikiDoc> {
    if (!data.slug || !data.breed) {
      throw new Error('Slug và Breed Name là bắt buộc.');
    }
    const existing = await DogBreedWikiModel.findOne({ 
      $or: [{ slug: data.slug }, { breed: data.breed }] 
    });
    if (existing) {
      throw new ConflictError('Slug hoặc Display Name đã tồn tại.');
    }
    return DogBreedWikiModel.create(data);
  },

  /**
   * READ (Single): Lấy thông tin của một giống chó bằng slug (cho người dùng công khai)
   */
  async getBreedBySlug(slug: string): Promise<DogBreedWikiDoc> {
    const breed = await DogBreedWikiModel.findOne({
      slug,
      isDeleted: false,
    });
    if (!breed) {
      throw new NotFoundError(`Không tìm thấy thông tin cho giống chó với slug: ${slug}`);
    }
    return breed;
  },

  /**
   * READ (Multiple by Slugs): Lấy thông tin của nhiều giống chó bằng mảng các slug.
   * Được sử dụng bởi BFF để làm giàu dữ liệu dự đoán.
   */
  async getBreedsBySlugs(slugs: string[]): Promise<DogBreedWikiDoc[]> {
    if (!slugs || slugs.length === 0) {
      return [];
    }
    const breeds = await DogBreedWikiModel.find({
      slug: { $in: slugs },
      isDeleted: false,
    });

    return breeds;
  },

  /**
   * READ (Multiple): Lấy danh sách tất cả các giống chó (có phân trang và tìm kiếm)
   */
  async getAllBreeds(options: QueryOptions) {
    const { page = 1, limit = 20, search, group, energy_level, trainability, shedding_level, suitable_for, ids, excludeIds } = options;
    const skip = (page - 1) * limit;

    // Logic sắp xếp linh hoạt hơn
    const allowedSortFields = ['breed', 'energy_level', 'trainability', 'shedding_level', 'maintenance_difficulty', 'rarity_level'];
    let sortOption: { [key: string]: 1 | -1 } = { breed: 1 }; // Mặc định sắp xếp theo tên A-Z

    if (options.sort) {
      const [field, direction] = options.sort.split('-');
      // const field = `breed.${lang}`; // Sắp xếp theo ngôn ngữ
      if (field === 'name' && allowedSortFields.includes('breed')) {
        sortOption = { breed: direction === 'desc' ? -1 : 1 };
      } else if (allowedSortFields.includes(field)) {
        sortOption = { [field]: direction === 'desc' ? -1 : 1 };
      }
    }

    // Lấy tất cả breed nếu isDeleted không phải là true
    const query: any = { isDeleted: { $ne: true } };
    
    // Xây dựng query động
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { breed: searchRegex },
        { slug: searchRegex }
      ];
    }
    if (group) query.group = group;
    if (energy_level) query.energy_level = energy_level;
    if (trainability) query.trainability = trainability;
    if (shedding_level) query.shedding_level = shedding_level;
    if (suitable_for) query.suitable_for = suitable_for;

    // SỬA LỖI: Sử dụng `ids` và `excludeIds` đã được controller chuẩn bị
    if (ids) {
      query._id = { $in: ids };
    } else if (excludeIds) {
      query._id = { $nin: excludeIds };
    }

    // Thực hiện 2 truy vấn song song để tối ưu
    const [breeds, total] = await Promise.all([
      DogBreedWikiModel.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit),
      DogBreedWikiModel.countDocuments(query)
    ]);
    
    return {
      data: breeds,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  },

  /**
   * READ: Đếm tổng số giống chó trong hệ thống.
   */
  async getTotalBreedsCount(): Promise<number> {
    return DogBreedWikiModel.countDocuments({ isDeleted: { $ne: true } });
  },

  /**
   * UPDATE: Admin cập nhật thông tin của một giống chó
   */
  async updateBreed(slug: string, data: Partial<DogBreedWikiDoc>): Promise<DogBreedWikiDoc> {
    const breed = await DogBreedWikiModel.findOneAndUpdate(
      { slug, isDeleted: { $ne: true } },
      data,
      { new: true, runValidators: true }
    );
    if (!breed) {
      throw new NotFoundError(`Không tìm thấy giống chó với slug: ${slug} để cập nhật.`);
    }
    return breed;
  },

  /**
   * DELETE (Soft): Admin xóa mềm một giống chó
   */
  async softDeleteBreed(slug: string): Promise<{ message: string }> {
    const result = await DogBreedWikiModel.updateOne(
      { slug, isDeleted: { $ne: true } },
      { isDeleted: true }
    );
    if (result.modifiedCount === 0) {
        throw new NotFoundError(`Không tìm thấy giống chó với slug: ${slug} để xóa.`);
    }
    return { message: 'Giống chó đã được xóa mềm thành công.' };
  },
};