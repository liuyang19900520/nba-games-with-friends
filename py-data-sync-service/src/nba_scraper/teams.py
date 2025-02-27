from nba_api.stats.static import teams
from nba_api.stats.static import players

from src.nba_scraper.DynamoDBHelper import DynamoDBHelper
from src.nba_scraper.utils import create_file_path

db_helper = DynamoDBHelper(table_name='NBA_Teams', region_name='ap-northeast-1')


def get_teams():
  return teams.get_teams();


def get_team_ids():
  dict_teams = teams.get_teams();
  team_ids = [team['id'] for team in dict_teams]
  return team_ids


def scrape_nba_teams():
  nba_teams = teams.get_teams();
  for team in nba_teams:
    db_helper.put_item(Item=team)


from nba_api.stats.endpoints import leaguestandings
from nba_api.stats.library.parameters import LeagueID
from datetime import datetime
import time

from nba_api.stats.endpoints import leaguestandings
from nba_api.stats.library.parameters import LeagueID
import time


def get_nba_standings():
  # 尝试获取数据，若失败则重试
  for attempt in range(3):
    try:
      # 获取最新的联盟排名数据
      standings = leaguestandings.LeagueStandings(league_id=LeagueID.default).get_dict()
      resultTeams = standings['resultSets'][0]['rowSet']
      headers = standings['resultSets'][0]['headers']
      break
    except Exception as e:
      print(f"获取数据失败，重试中...({attempt + 1}/3)")
      time.sleep(2)
  else:
    print("获取数据失败，请稍后再试。")
    return

  nba_teams = teams.get_teams()
  id_to_abbreviation = {team['id']: team['abbreviation'] for team in nba_teams}

  # 直接使用 API 返回的字段名
  standings_data = {'East': [], 'West': []}
  for team in resultTeams:
    team_data = {
      'id': team[headers.index('TeamID')],
      'TeamName': team[headers.index('TeamName')],
      'Conference': team[headers.index('Conference')],
      'Wins': team[headers.index('WINS')],
      'Losses': team[headers.index('LOSSES')],
      'WinPct': round(team[headers.index('WinPCT')] * 100, 1),  # 转换为百分比
      'ConferenceGamesBack': team[headers.index('ConferenceGamesBack')],
      'Streak': team[headers.index('CurrentStreak')],
      'abbreviation': id_to_abbreviation.get(team[headers.index('TeamID')])
    }

    # 根据联盟分组
    if team_data['Conference'] == 'East':
      standings_data['East'].append(team_data)
    elif team_data['Conference'] == 'West':
      standings_data['West'].append(team_data)

  # 排序：按胜率降序排列
  standings_data['East'].sort(key=lambda x: x['WinPct'], reverse=True)
  standings_data['West'].sort(key=lambda x: x['WinPct'], reverse=True)

  db_helper.batch_put_items(standings_data['East'])
  db_helper.batch_put_items(standings_data['West'])

  return standings_data


def scraper_teams():
  db_helper.delete_table()
  json_file = create_file_path("tables", "table-definition-nba-team.json")
  db_helper.create_table_from_json(json_file)

  get_nba_standings()
