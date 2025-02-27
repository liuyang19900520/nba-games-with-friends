from nba_api.stats.endpoints import scoreboardv2


def get_tomorrow_games():
  # 获取明天的日期
  tomorrow = datetime.now() + timedelta(days=1)
  game_date = tomorrow.strftime('%Y-%m-%d')  # 格式化日期为 'YYYY-MM-DD'

  # 获取明天的比赛信息
  scoreboard = scoreboardv2.ScoreboardV2(game_date=game_date)
  games = scoreboard.get_dict()['resultSets'][0]['rowSet']

  # 解析比赛信息
  game_list = []
  for game in games:
    game_info = {
      'GAME_ID': game[2],
      'GAME_DATE': game[0],
      'MATCHUP': f"{game[5]} vs {game[7]}",
      'GAME_STATUS': game[4]  # 状态: Scheduled, In Progress, Final
    }
    game_list.append(game_info)

  return game_list


from nba_api.stats.endpoints import ScoreboardV2, BoxScoreTraditionalV2
from datetime import datetime, timedelta
import time  # 用于请求间隔，防止被 NBA 封禁


def get_yesterday_player_stats():
  # 获取昨天的日期
  yesterday = datetime.now() - timedelta(days=1)
  game_date = yesterday.strftime('%Y-%m-%d')

  # 获取昨天的比赛信息
  scoreboard = ScoreboardV2(game_date=game_date)
  games = scoreboard.get_dict()['resultSets'][0]['rowSet']

  game_ids = [game[2] for game in games if game[4].strip() == 'Final']  # 获取已结束比赛的 GAME_ID 列表
  all_player_stats = []

  # 遍历每场比赛
  for game_id in game_ids:
    print(f"正在获取比赛 {game_id} 的球员数据...")

    # 获取球员统计
    box_score = BoxScoreTraditionalV2(game_id=game_id)
    players = box_score.get_dict()['resultSets'][0]['rowSet']
    headers = box_score.get_dict()['resultSets'][0]['headers']

    # 整理每个球员的数据
    for player in players:
      player_stats = {}
      for i, header in enumerate(headers):
        player_stats[header] = player[i]
      all_player_stats.append(player_stats)

    # 请求间隔，防止被封
    time.sleep(1)

  return all_player_stats
