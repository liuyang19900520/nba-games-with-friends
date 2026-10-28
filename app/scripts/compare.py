# side-by-side: v1 (legacy-v1 rendered locally) vs new MVP
from PIL import Image, ImageDraw, ImageFont
import os
S='/workspace/work/nba-mvp/screens/'
pairs=[('v1-home.png','01-schedule.png','首页/赛程'),('v1-match.png','07-game-detail.png','比赛详情')]
try: font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',36)
except Exception: font=ImageFont.load_default()
W,H=390*2,844*2; pad=24; top=70
cols=[]
for a,b,title in pairs:
  if not (os.path.exists(S+a) and os.path.exists(S+b)): continue
  cols.append((Image.open(S+a).resize((W//2,H//2)),Image.open(S+b).resize((W//2,H//2)),title))
out=Image.new('RGB',(len(cols)*(W+pad*3),H//2+top+20),'#0D121D'); d=ImageDraw.Draw(out)
for i,(a,b,title) in enumerate(cols):
  x=i*(W+pad*3)+pad
  d.text((x,14),f'{title}: v1 (左)  vs  MVP (右)',fill='#6EE2F5',font=font)
  out.paste(a,(x,top)); out.paste(b,(x+W//2+pad,top))
out.save(S+'compare-v1-vs-mvp.png'); print(out.size)
