-- 添加父子任务关系
-- tasks 表新增 parent_id 列，支持任务层级结构

ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
