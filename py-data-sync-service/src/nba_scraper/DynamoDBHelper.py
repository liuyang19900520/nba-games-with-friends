import boto3
import json
from botocore.exceptions import ClientError
from decimal import Decimal


class DynamoDBHelper:
  def __init__(self, table_name, region_name='us-east-1'):
    self.dynamodb = boto3.resource('dynamodb', region_name=region_name)
    self.table_name = table_name
    self.table = self.dynamodb.Table(table_name)

  # 递归地将所有 float 转为 Decimals
  def convert_floats_to_decimal(self, data):
    if isinstance(data, list):
      return [self.convert_floats_to_decimal(item) for item in data]
    elif isinstance(data, dict):
      return {k: self.convert_floats_to_decimal(v) for k, v in data.items()}
    elif isinstance(data, float):
      return Decimal(str(data))  # 将 float 转为 Decimal
    else:
      return data

  # 1. 插入或更新单项
  def put_item(self, item):
    try:
      self.table.put_item(Item=item)
      print(f"插入/更新成功: {item}")
    except ClientError as e:
      print(f"插入/更新失败: {e.response['Error']['Message']}")

  # 2. 获取单项
  def get_item(self, key):
    try:
      response = self.table.get_item(Key=key)
      item = response.get('Item')
      print(f"获取成功: {item}")
      return item
    except ClientError as e:
      print(f"获取失败: {e.response['Error']['Message']}")

  # 3. 更新单项
  def update_item(self, key, update_expression, expression_attribute_values):
    try:
      response = self.table.update_item(
        Key=key,
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_attribute_values,
        ReturnValues="UPDATED_NEW"
      )
      print(f"更新成功: {response['Attributes']}")
    except ClientError as e:
      print(f"更新失败: {e.response['Error']['Message']}")

  # 4. 删除单项
  def delete_item(self, key):
    try:
      self.table.delete_item(Key=key)
      print(f"删除成功: {key}")
    except ClientError as e:
      print(f"删除失败: {e.response['Error']['Message']}")

  # 5. 批量插入
  def batch_put_items(self, items):
    items = self.convert_floats_to_decimal(items)
    try:
      with self.table.batch_writer() as batch:
        for item in items:
          batch.put_item(Item=item)
      print(f"批量插入成功: {len(items)} 项")
    except ClientError as e:
      print(f"批量插入失败: {e.response['Error']['Message']}")

  # 6. 批量删除
  def batch_delete_items(self, keys):
    try:
      with self.table.batch_writer() as batch:
        for key in keys:
          batch.delete_item(Key=key)
      print(f"批量删除成功: {len(keys)} 项")
    except ClientError as e:
      print(f"批量删除失败: {e.response['Error']['Message']}")

  # 7. 删除表
  def delete_table(self):
    try:
      table = self.dynamodb.Table(self.table_name)
      table.delete()
      print(f"表已删除: {self.table_name}")
    except ClientError as e:
      print(f"删除表失败: {e.response['Error']['Message']}")

  # 8. 根据 JSON 文件创建表
  def create_table_from_json(self, json_file_path):
    try:
      with open(json_file_path, 'r') as file:
        table_definition = json.load(file)

      # 创建表
      table = self.dynamodb.create_table(**table_definition)
      table.wait_until_exists()
      print(f"表已创建: {table.table_name}")
    except ClientError as e:
      print(f"创建表失败: {e.response['Error']['Message']}")
    except FileNotFoundError:
      print(f"JSON 文件未找到: {json_file_path}")
    except json.JSONDecodeError:
      print(f"JSON 文件格式错误: {json_file_path}")
