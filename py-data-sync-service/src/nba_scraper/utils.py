import json
# 如果tables文件夹在项目根目录下
import os
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


def create_file_path(dir_name, file_name):
  project_root = Path(__file__).parent.parent.parent  # 调整parent的数量以达到根目录
  path_to_x = os.path.join(project_root, dir_name, file_name)
  return path_to_x


def delete_table_resource_api(table_name):
  """使用 boto3 资源 API 删除表"""
  # 创建 DynamoDB 资源
  dynamodb = boto3.resource('dynamodb')
  table = dynamodb.Table(table_name)

  try:
    table.delete()
    print(f"表 '{table_name}' 删除请求已发送")

    # 等待表被删除
    table.meta.client.get_waiter('table_not_exists').wait(TableName=table_name)
    print(f"表 '{table_name}' 已成功删除")
    return True

  except ClientError as e:
    print(f"删除表时出错: {e}")
    return False


def create_table_from_json(json_file_path):
  # 读取 JSON 文件
  with open(json_file_path, "r") as f:
    table_definition = json.load(f)

  # 获取表的定义
  table_info = table_definition["Table"]

  # 初始化 DynamoDB 客户端
  dynamodb = boto3.resource("dynamodb")

  # 提取表定义中的必要参数
  table_params = {
    "TableName": table_info["TableName"],
    "KeySchema": table_info["KeySchema"],
    "AttributeDefinitions": table_info["AttributeDefinitions"]
  }

  # 处理计费模式
  if "BillingModeSummary" in table_info and table_info["BillingModeSummary"]["BillingMode"] == "PAY_PER_REQUEST":
    table_params["BillingMode"] = "PAY_PER_REQUEST"
  else:
    table_params["ProvisionedThroughput"] = {
      "ReadCapacityUnits": table_info["ProvisionedThroughput"]["ReadCapacityUnits"],
      "WriteCapacityUnits": table_info["ProvisionedThroughput"]["WriteCapacityUnits"]
    }

  # 创建表
  try:
    table = dynamodb.create_table(**table_params)
    print(f"Creating table {table_info['TableName']}...")
    table.wait_until_exists()  # 等待表创建完成
    print(f"Table {table_info['TableName']} created successfully!")
  except Exception as e:
    print(f"Error creating table: {e}")
