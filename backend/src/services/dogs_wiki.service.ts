import { DogBreedWikiModel, DogBreedWikiDoc } from '../models/dogs_wiki.model';
import { ConflictError } from '../errors';

// Các tùy chọn cho việc lấy danh sách
interface QueryOptions {
  page: number;
  limit: number;
  search?: string;
  group?: string;
  energy_level?: number;
  trainability?: number;
  shedding_level?: number;
  suitable_for?: string;
  sort?: string;
}

export const wikiService = {
  /**
   * CREATE: Admin thêm một giống chó mới vào wiki
   */
  async createBreed(data: Partial<DogBreedWikiDoc>): Promise<DogBreedWikiDoc> {
    if (!data.slug || !data.display_name) {
      throw new Error('Slug và Display Name là bắt buộc.');
    }
    const existing = await DogBreedWikiModel.findOne({ 
      $or: [{ slug: data.slug }, { display_name: data.display_name }] 
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
      throw new ConflictError(`Không tìm thấy thông tin cho giống chó với slug: ${slug}`);
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
    const { page = 1, limit = 20, search, group, energy_level, trainability, shedding_level, suitable_for, sort = 'display_name' } = options;
    const skip = (page - 1) * limit;

    // Lấy tất cả breed nếu isDeleted không phải là true
    const query: any = { isDeleted: { $ne: true } };
    
    // Xây dựng query động
    if (search) {
      query.display_name = { $regex: search, $options: 'i' };
    }
    if (group) query.group = group;
    if (energy_level) query.energy_level = energy_level;
    if (trainability) query.trainability = trainability;
    if (shedding_level) query.shedding_level = shedding_level;
    if (suitable_for) query.suitable_for = suitable_for;

    const breeds = await DogBreedWikiModel.find(query)
      // Sắp xếp theo trường được chỉ định hoặc mặc định là display_name
      .sort({ [sort]: 1 })
      .skip(skip)
      .limit(limit);

    const total = await DogBreedWikiModel.countDocuments(query);
    
    return {
      data: breeds,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
      throw new ConflictError(`Không tìm thấy giống chó với slug: ${slug} để cập nhật.`);
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
        throw new ConflictError(`Không tìm thấy giống chó với slug: ${slug} để xóa.`);
    }
    return { message: 'Giống chó đã được xóa mềm thành công.' };
  },
};