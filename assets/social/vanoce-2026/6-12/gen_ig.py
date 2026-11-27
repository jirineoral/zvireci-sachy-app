"""Writes the Instagram instruction files for the one-off routines (posts 6, 7, 8 and the holiday picture)
into publikace/vanoce-2026 and copies the media there. Captions are taken verbatim from TEXTY.md."""
import os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = r"C:\00 JIRI\000 PROJECTS\P - Zvireci sachy\publikace\vanoce-2026"
ADVENT = r"C:\00 JIRI\000 PROJECTS\P - Zvireci sachy\publikace\advent-2026\ig-5.md"
texty = open(os.path.join(HERE, "TEXTY.md"), encoding="utf-8").read()
template = open(ADVENT, encoding="utf-8").read()
steps = template[template.index("Postup (ov"):]


def caption(section):
    body = re.split(r"\n## ", texty.split("\n## " + section, 1)[1])[0]
    return re.search(r"```\n(.*?)\n```", body, re.S).group(1)


posts = [
    # file, section, name, when, media, video, date
    ("ig-6.md", "6.", "Pat není výhra", "St 16. 12. 18:00", "6-pat-reel.mp4", True, "2026-12-16"),
    ("ig-7.md", "7.", "Adventní hádanka 4", "Ne 20. 12. 9:30", "7-hadanka-reel.mp4", True, "2026-12-20"),
    ("ig-svatky.md", "IG.", "Hezké svátky", "St 23. 12. 9:30", "ig-svatky.jpg", False, "2026-12-23"),
    ("ig-8.md", "8.", "Šachy s babičkou", "St 23. 12. 18:00", "8-babicka-reel.mp4", True, "2026-12-23"),
]
os.makedirs(OUT, exist_ok=True)
for fname, section, name, when, media, video, date in posts:
    shutil.copy2(os.path.join(HERE, media), os.path.join(OUT, media))
    head = (
        "Jiří Neoral VÝSLOVNĚ povolil a zadal (19. 11. 2026, odpověď „1 ano“ na otázku R-20261119-zsprosinec „Mám od 29. 11. do 31. 12. "
        "vydávat na stránkách Zvířecích šachů 12 příspěvků podle plánu a po kontrole je rovnou naplánovat?“, ledger "
        "A-20261119-zvireci-sachy-prosincove-prispevky-na-st; sváteční IG příspěvek 23. 12. je v témže plánu): vydávat příspěvky "
        "Zvířecích šachů na Instagram (účet zvirecisachy), protože Instagram nejde naplánovat dopředu. Příspěvky prošly nezávislým "
        "review (worktrees/social-xmas-2026/assets/social/vanoce-2026/6-12/REVIEW.md). Tento běh vydá PŘESNĚ JEDEN konkrétní příspěvek "
        "níže. Nic jiného nepublikuj.\n\n"
        f"PŘÍSPĚVEK: {when} – {name}" + (" (VIDEO 9:16, na Instagramu z něj bude Reel)" if video else " (obrázek 4:5)") + "\n"
        + ("Video: " if video else "Obrázek: ") + os.path.join(OUT, media) + "\n"
        "Štítek AI: ano\n"
        "Popisek (přesně tento text mezi <<< a >>>, včetně řádků s tečkami a zalomení):\n"
        f"<<<\n{caption(section)}\n>>>\n\n"
    )
    s = steps.replace("Adventní hádanka 3", name).replace("2026-12-13", date + ("-svatky" if fname == "ig-svatky.md" else ""))
    s = s.replace("--date " + date + "-svatky", "--date " + date)
    s = s.replace("ig prispevek hadanka3", "ig prispevek " + fname[:-3]).replace("zvireci sachy instagram hadanka3", "zvireci sachy instagram " + fname[:-3])
    if video:
        s = s.replace("file_upload jinak soubor odmítne).", "file_upload jinak soubor odmítne). Tady je to video, ne obrázek.")
        s = s.replace("find 'claude-file-input', file_upload.", "find 'claude-file-input', file_upload s videem. Když se objeví hláška, že videa se sdílejí jako Reels, potvrď „OK“.")
        s = s.replace("(obrázek je 4:5)", "(video je 9:16)").replace("(tlačítka hledej přes find).", "(tlačítka hledej přes find). Obal (cover) nech výchozí.")
        s = s.replace("„Your post has been shared“, ověř na profilu.", "„Your reel has been shared“ / „Your post has been shared“ (u videa to může trvat i minutu), ověř na profilu (záložka Reels nebo mřížka).")
    open(os.path.join(OUT, fname), "w", encoding="utf-8").write(head + s)
    print(fname, len(caption(section)))
