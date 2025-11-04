from pymongo import MongoClient
MONGO_URI="mongodb+srv://vtduong04_db_user:doantotnghiep@cluster0.zqtdmdc.mongodb.net/dog_breed_id?retryWrites=true&w=majority"

# Kết nối tới MongoDB (sửa URI nếu cần)
client = MongoClient(MONGO_URI)
db = client["dog_breed_id"]
collection = db["dog_breed_wikis_vi"]

# Mapping giữa tiếng Việt và tiếng Anh
group_mapping = {
    "Nhóm chó thể thao": "Sporting",
    "Nhóm chó cảnh nhỏ": "Toy",
    "Nhóm chó chăn gia súc": "Herding",
    "Hoang dã": "Wild",
    "Nhóm chó sục": "Terrier",
    "Nguyên thủy": "Primitive",
    "Nhóm chó săn": "Hound",
    "Nhóm không thể thao": "Non-Sporting",
    "Nhóm chó làm việc": "Working"
}

# Cập nhật tất cả documents theo mapping
for vn_group, en_group in group_mapping.items():
    result = collection.update_many(
        {"group": vn_group},
        {"$set": {"group": en_group}}
    )
    print(f"Updated {result.modified_count} documents: {vn_group} → {en_group}")

print("✅ Done updating all group names.")
