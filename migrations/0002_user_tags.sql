PRAGMA foreign_keys = ON;

-- 用户自定义标签库。记录（mood_entries.tags）中只保存标签名，
-- 颜色与首字在这里维护，日历和记录页据此渲染。
CREATE TABLE IF NOT EXISTS user_tags (
  user_id TEXT NOT NULL,                      -- 所属账号
  name TEXT NOT NULL,                         -- 标签名，同一账号内唯一，与 mood_entries.tags 中的字符串对应
  color TEXT NOT NULL,                        -- 展示色，存 #rrggbb
  initial TEXT NOT NULL,                      -- 首字，移动端日历只显示这一到两个字符
  sort_order INTEGER NOT NULL DEFAULT 0,      -- 排序值，越小越靠前
  created_at TEXT NOT NULL,                   -- 创建时间 ISO 8601
  PRIMARY KEY (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_tags_user_sort ON user_tags(user_id, sort_order);
