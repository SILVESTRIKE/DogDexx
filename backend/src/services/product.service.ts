import { ProductModel, ProductDoc } from "../models/product.model";

export interface CreateProductInput {
  name: string;
  quantity: number;
  slug: string;
  price: number;
  description?: string;
}

export class ProductService {
  static async getAll(options: { page?: number, limit?: number, search?: string } = {}): Promise<{ data: ProductDoc[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;
    const query: any = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    const [products, total] = await Promise.all([
      ProductModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ProductModel.countDocuments(query)
    ]);

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getById(id: string): Promise<ProductDoc> {
    const product = await ProductModel.findById(id);
    if (!product) throw new Error("Không tìm thấy sản phẩm");
    return product;
  }

  static async getBySlug(slug: string): Promise<ProductDoc> {
    const product = await ProductModel.findOne({ slug });
    if (!product) throw new Error("Không tìm thấy sản phẩm");
    return product;
  }

  static async create(data: CreateProductInput): Promise<ProductDoc> {
    if (!data.name || !data.quantity || !data.slug || !data.price) {
      throw new Error("Vui lòng điền đủ các trường name, quantity, slug");
    }
    const product = new ProductModel(data);
    return await product.save();
  }

  static async update(
    id: string,
    data: Partial<CreateProductInput>
  ): Promise<ProductDoc> {
    const product = await ProductModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!product) throw new Error("Không tìm thấy sản phẩm");
    return product;
  }

  static async delete(id: string): Promise<boolean> {
    const product = await ProductModel.findByIdAndDelete(id);
    if (!product) throw new Error("Không tìm thấy sản phẩm");
    return true;
  }
}
