import requests
from nba_api.stats.static import players

from nba_api.stats.endpoints import playercareerstats

from src.nba_scraper.DynamoDBHelper import DynamoDBHelper
from src.nba_scraper.utils import create_file_path

db_helper = DynamoDBHelper(table_name='NBA_Players', region_name='ap-northeast-1')


def find_player(player_id):
  play = players.find_player_by_id(player_id)
  return play


def find_player_career_stats(player_id):
  career = playercareerstats.PlayerCareerStats(player_id).get_dict()
  keys = career['resultSets'][0]['headers']
  values = career['resultSets'][0]['rowSet']

  result_per = []
  for value_list in values:
    item_per = {}
    for i in range(len(keys)):
      # 将每一列对应的键值对加入字典
      if i > 7 and value_list[6] != 0:  # 防止除以 0 错误
        item_per[keys[i]] = round(value_list[i] / value_list[6], 1)
      else:
        item_per[keys[i]] = value_list[i]
    # 每个赛季的数据作为一个完整的字典加入列表
    result_per.append(item_per)
  return result_per


def find_player_career_stats_by_season(player_id, season_id):
  career = playercareerstats.PlayerCareerStats(player_id).get_dict()
  keys = career['resultSets'][0]['headers']
  values = career['resultSets'][0]['rowSet']

  for value_list in values:
    item_per = {}
    for i in range(len(keys)):
      # 将每一列对应的键值对加入字典
      if i > 7 and value_list[6] != 0:  # 防止除以 0 错误
        item_per[keys[i]] = round(value_list[i] / value_list[6], 1)
      else:
        item_per[keys[i]] = value_list[i]
    if item_per.get('SEASON_ID') == season_id:
      return item_per


def scrape_nba_team_players(team_id, season):
  db_helper.delete_table()
  json_file = create_file_path("tables", "table-definition-nba-players.json")
  db_helper.create_table_from_json(json_file)

  url = "https://stats.nba.com/stats/commonteamroster"
  params = {
    "TeamID": team_id,
    "Season": season,
  }
  headers = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://www.nba.com/"
  }

  response = requests.get(url, headers=headers, params=params)
  res_data = response.json()
  keys = res_data['resultSets'][0]['headers']
  values = res_data['resultSets'][0]['rowSet']

  # 将数据转换为字典并存入 DynamoDB
  for value_list in values:
    # 创建字典
    item = {keys[i]: value_list[i] for i in range(len(keys))}

    age = item['AGE']
    item['AGE'] = int(age)
    # 输出生成的字典查看
    print(f"将要存储的项目: {item}")

    # 存入 DynamoDB
    response = db_helper.put_item(Item=item)

    # 检查操作结果
    if response['ResponseMetadata']['HTTPStatusCode'] == 200:
      print(f"成功存储项目: {item}")
    else:
      print(f"存储项目失败: {item}")
