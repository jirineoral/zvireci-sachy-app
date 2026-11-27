"""Writes publikace/vanoce-2026/fb-10-12.md: Meta Business Suite allows scheduling at most 29 days ahead,
so posts 10-12 are scheduled by a one-off routine on 3 Dec. Texts are taken verbatim from TEXTY.md."""
import os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = r"C:\00 JIRI\000 PROJECTS\P - Zvireci sachy\publikace\vanoce-2026"
texty = open(os.path.join(HERE, "TEXTY.md"), encoding="utf-8").read()


def fb(num):
    sec = re.split(r"\n## ", texty.split(f"\n## {num}. ", 1)[1])[0]
    part = sec.split("**Facebook**")[-1] if "**Facebook**" in sec else sec
    lines = []
    for l in part.split("\n"):
        if l.startswith(">"):
            lines.append(l[2:] if l.startswith("> ") else l[1:])
        elif lines:
            break
    return "\n".join(lines)


posts = [(10, "Ne 27. 12. 2026, 9:30 (09:30 AM)", "12/27/2026", "10-hadanka-reel.mp4"),
         (11, "St 30. 12. 2026, 18:00 (06:00 PM)", "12/30/2026", "11-predsevzeti-reel.mp4"),
         (12, "Čt 31. 12. 2026, 9:30 (09:30 AM)", "12/31/2026", "12-pf-2027.jpg")]
body = r"""Jiří Neoral VÝSLOVNĚ povolil a zadal (19. 11. 2026, „1 ano“ na otázku R-20261119-zsprosinec „Mám od 29. 11. do 31. 12. vydávat na stránkách Zvířecích šachů 12 příspěvků podle plánu a po kontrole je rovnou naplánovat?“): naplánovat na FACEBOOKOVOU STRÁNKU „Zvířecí šachy“ tři zbývající prosincové příspěvky. Prošly nezávislým review (worktrees/social-xmas-2026/assets/social/vanoce-2026/6-12/REVIEW.md). Naplánuj PŘESNĚ tyto tři, nic jiného nevytvářej, neupravuj ani nemaž. Nepublikuj hned (vždy jen „Schedule“), žádný Boost, žádné Story.

Postup:
1. Claude in Chrome (mcp__claude-in-chrome__*, nástroje načti jedním ToolSearch). Jiřího Edge, profil Personal: nejdřív `pwsh -NoProfile -File "C:\00 JIRI\00 BRAIN\tools\edge\Get-EdgeProfileMap.ps1"`, select_browser s deviceId profilu Personal, vlastní nová záložka. Nikdy se nepřihlašuj heslem.
2. Otevři https://business.facebook.com/latest/posts/scheduled_posts?asset_id=1372724692581568 a zkontroluj, co už naplánované je. Co už tam na daný den je, nevytvářej znovu.
3. Soubory nejdřív zkopíruj PowerShellem do svého scratchpadu.
4. Pro každý příspěvek otevři https://business.facebook.com/latest/composer?asset_id=1372724692581568, ověř „Post to: Zvířecí šachy“. Aby se neotevřelo nativní okno pro výběr souboru, před klikem na „Add photo/video“ přes javascript přepiš HTMLInputElement.prototype.click tak, že u type=file prvek jen přidá do stránky s aria-label „claude-file-input“; pak find a file_upload. Text napiš do textového pole přesně podle zadání (zalomení Enter). Zapni „Set date and time“, datum zadej do pole mm/dd/yyyy (trojklik, napsat, Tab), čas do polí hours / minutes / meridiem. Před klikem na „Schedule“ udělej screenshot a ověř datum i čas.
5. Nakonec otevři znovu seznam Scheduled a ověř tři nové řádky s časy.
6. Připiš řádek do C:\00 JIRI\000 PROJECTS\P - Zvireci sachy\app\assets\social\tyden-2026-10-12\PUBLIKACE-LOG.md (datum, „Facebook stránka (MBS)“, termíny, názvy, stav ověření). Zavři svou záložku.
7. PushNotification česky pod 200 znaků. Když se něco nepodaří, zařaď alert `powershell -File "C:\00 JIRI\00 BRAIN\tools\alerts\alerts.ps1" -Add -Source zs-fb -Severity critical -Title "NEHOTOVO: FB Zvířecí šachy 27.-31. 12." -Detail "<co selhalo>" -DedupKey "zs-fb:2026-12-03"` a závěrečnou zprávu začni slovem NEHOTOVO:.
"""
for num, when, date, media in posts:
    shutil.copy2(os.path.join(HERE, media), os.path.join(OUT, media))
    body += f"\nPŘÍSPĚVEK {num}: {when}, datum do pole: {date}\nSoubor: {os.path.join(OUT, media)}\nText (přesně mezi <<< a >>>):\n<<<\n{fb(num)}\n>>>\n"
open(os.path.join(OUT, "fb-10-12.md"), "w", encoding="utf-8").write(body)
print(len(body))
