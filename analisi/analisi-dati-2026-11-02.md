# Bilancio — analisi del backup e dei movimenti (2 novembre 2026)

**File analizzati:** `bilancio-backup-20261102.json` (11 conti, 8 macrocategorie, 29 categorie, 197 movimenti, 15 ricorrenti, 4 pianificate, 7 stime, 1 piano stipendio, 24 elementi nel cestino) e `bilancio-movimenti-20261102.csv` (197 righe).
**Controllo incrociato:** il CSV coincide con il backup (stesse 197 righe, stesso totale importi 25.290,35 €). Nessun movimento punta a conti o categorie che non esistono; nessuna uscita con categoria di entrata (o viceversa).

Saldi calcolati oggi (come li mostra l'app):

| Conto | Saldo | Ultimo "saldo reale" registrato |
|---|---:|---|
| TR (conto risparmio) | 3.104,00 € | 27/10 (1.600,00 €) |
| Revolut | 157,15 € | mai |
| BBVA (principale) | 5,27 € | 27/10 (0,07 €) |
| Contanti | 0,00 € | mai |
| Credit Agricole | 0,00 € | mai |
| Wise | 0,00 € | 27/10 (0,00 €) |
| **Poste** | **−4,00 €** | mai |
| **Fineco** | **−100,50 €** | 27/10 (165,00 €) |
| Da ricevere · Ilaria | 111,27 € | — |
| Da pagare · Ilaria | 0,00 € | — |

Riepilogo per mese (senza rettifiche e giroconti, come le Statistiche):

| Mese | Entrate | Uscite | Netto | Note |
|---|---:|---:|---:|---|
| Settembre (dal 21) | 2.823,05 € | 670,10 € | +2.152,95 € | 753,65 € delle entrate sono saldi iniziali (vedi 1.2) |
| Ottobre | 2.387,39 € | 3.892,54 € | −1.505,15 € | 1.187 € di scommesse, 500 € caparra, 500 € rata iPhone |
| Novembre (1-2) | 49,00 € | 937,50 € | −888,50 € | affitto + bollette 716 € |

---

## 1. Priorità alta

### 1.1 Due conti in rosso: Fineco −100,50 € e Poste −4,00 €
- **Fineco.** Il 27/10 hai registrato il saldo reale (165,00 €). Dopo: −150 (→ BBVA, 28/10), +2.212 (stipendio, 30/10), −1.500 (→ TR), −39 (→ Wise), −72,50 di spese il 1/11 e **−716 € "Affitto casa vecchia + bollette + pulizia caldaia" il 2/11**. Quella spesa era pianificata su **BBVA** (si vede nella copia salvata della pianificata) ma è stata registrata su **Fineco**: è lei che porta il conto sotto zero.
  **Come sistemare:** controlla in banca da dove è uscito l'affitto. Se è uscito da BBVA → tieni premuto il movimento › Modifica › conto BBVA. Se è uscito davvero da Fineco, manca un'entrata o un giroconto verso Fineco: registralo, oppure Conti › Fineco › Rettifica con il saldo vero.
- **Poste.** Il conto non ha mai ricevuto soldi: ci sono solo i due "Costo carta" ricorrenti da 2 € (1/10 e 1/11).
  **Come sistemare:** se la carta Poste ha soldi, imposta il saldo reale (Conti › Poste › Modifica). Se il costo carta in realtà esce da un altro conto, sposta il ricorrente su quel conto. Se la carta non la usi più, sospendi il ricorrente.

### 1.2 Settembre: 753,65 € di "Stipendio" che sono saldi di partenza
Quattro entrate **senza nome**, categoria Stipendio, il 21-22/09: BBVA 116,50 · TR 400,00 · Wise 207,15 · Contanti 30,00. Lo stipendio vero di settembre è quello del 30/09 (2.061 €). Sono i soldi già presenti sui conti quando hai iniziato a usare l'app (come i due "Fondi già presenti" del 23/09 che erano già stati trasformati in Rettifica).
**Effetto:** le entrate di settembre risultano 2.823 € invece di 2.069 € (Statistiche e Analisi gonfiate).
**Come sistemare:** vanno trasformate in "Rettifica saldo" (il saldo dei conti resta identico, spariscono dalle entrate). Dall'app non c'è un comando per farlo: si può fare con una piccola correzione automatica una tantum (vedi §5), basta chiederla.

### 1.3 Troppe rettifiche: circa 1.300 € di ottobre non spiegati
31 rettifiche di saldo in 6 settimane (17 a settembre, 14 a ottobre). A ottobre le rettifiche aggiungono +1.755,77 € e tolgono −452,98 €: **+1.302,79 € entrati sui conti senza un movimento**. Le più grandi:

| Data | Conto | Rettifica | Da → a |
|---|---|---:|---|
| 20/10 | BBVA | +324,65 € | −324,20 € → 0,45 € |
| 20/10 | TR | −426,00 € | 1.333,00 € → 907,00 € |
| 27/10 | TR | +803,00 € | 797,00 € → 1.600,00 € |
| 27/10 | Fineco | +250,34 € | −85,34 € → 165,00 € |
| 27/10 | Wise | +180,46 € | −180,46 € → 0,00 € |
| 27/10 | BBVA | +167,36 € | −167,29 € → 0,07 € |

Le rettifiche non entrano nelle statistiche: quei soldi non risultano né come entrate né come uscite, quindi **il "netto" del mese è sbagliato** (ottobre −1.505 € nelle statistiche, ma sui conti la perdita reale è stata molto minore).
Wise da solo ha 10 rettifiche: le spese su Wise (Spotify, iCloud, ATM, ordini a rate) vengono registrate, le ricariche di Wise spesso no.
**Come sistemare:** quando il saldo non torna, prima di rettificare cerca il movimento mancante (soprattutto ricariche di Wise e soldi in arrivo). Per i prossimi mesi: ogni ricarica di Wise = trasferimento.

### 1.4 Scommesse: le ricariche ci sono, le vincite quasi mai
A ottobre ci sono 9 uscite "Scommesse" per **1.187 €** (1.149 € di ricariche Bet da BBVA, più 38 € di abbonamenti TotalCorner) e solo **112,15 €** di entrate "Bet" (dal 30/10, su Revolut; altri 45 € il 1/11). È molto probabile che buona parte delle rettifiche positive del punto 1.3 siano vincite o prelievi dal conto gioco arrivati sui conti senza essere registrati.
**Effetto:** "Tempo libero" risulta 1.910,89 € contro un budget di 302 €, e le uscite del mese sono gonfiate.
**Come sistemare (consigliato):** crea un conto "Conto gioco" (o usa Revolut se è quello che usi per il gioco): ricarica = trasferimento BBVA → Conto gioco; prelievo = trasferimento Conto gioco → banca; vinto/perso = entrata "Bet" / uscita "Scommesse" sul Conto gioco. Così i saldi tornano senza rettifiche e le statistiche mostrano il risultato vero del gioco.

### 1.5 Risparmio con la nuova regola (v1.67.0)
- Conto risparmio: **TR**, obiettivo **400 €/mese**.
- Con la regola vecchia (bonifici verso TR meno quelli in uscita) risultava: settembre +1.220 €, ottobre **−1.661 €**, novembre **+1.500 €** ("✓ Fatto" già il 1/11).
- In realtà TR fa da conto "di passaggio": il 30/09 e il 1/11 ricevi 1.500 € da Fineco (stipendio), poi durante il mese li riporti su BBVA (a ottobre 1.683 € da TR a BBVA/Fineco in 9 giroconti) e paghi spese direttamente da TR (ottobre 650 €: caparra 500, hotel Valencia 120, McDonald 18, Lidl 12; il 15/11 sono pianificati altri 1.065 € da TR: 2ª rata caparra 500 + affitto casa nuova 565).
- **Dalla 1.67.0 nessun trasferimento è contrassegnato**, quindi il risparmio di ottobre e novembre è 0 €. In Home, sotto il riquadro, l'app ti segnala il trasferimento del 1/11 (1.500 €) verso TR "non contato".
**Come fare d'ora in poi:** quando metti da parte dei soldi usa "Metti da parte" in Home (l'interruttore 🐷 Deposito di risparmio è già acceso) o accendilo tu nel trasferimento. Il 1.500 € del 1/11 contrassegnalo solo se resterà davvero su TR.

---

## 2. Priorità media

### 2.1 Ricorrenti e pianificate sul conto sbagliato
- **JetCredit 130 €** (ricorrente su **BBVA**, prossima 15/11): il 10/10 l'hai pagata da **Credit Agricole** (con un giroconto BBVA → Credit Agricole di 132 € = 130 + 2 di costo carta). La prossima verrà proposta su BBVA. Se il finanziamento esce da Credit Agricole, sposta il ricorrente su Credit Agricole e ricorda il giroconto mensile.
- **Costo carta Credit Agricole 2 €** domani (3/11): il conto è a 0 → andrà a −2 €.
- **Stipendio novembre 2.100 €** pianificato su **BBVA** il 30/11, ma settembre e ottobre sono arrivati su **Fineco**. Controlla il conto (cambia le previsioni di BBVA e Fineco).
- **Affitto 2/11** pianificato su BBVA ma registrato su Fineco (vedi 1.1).

### 2.2 Budget da rivedere (ottobre)

| Budget | Limite | Speso a ottobre |
|---|---:|---:|
| Tempo libero (macro) | 302 € | 1.910,89 € (scommesse 1.187, shopping 347, viaggi 308, svago 66) |
| Debiti e rate (macro) | 282 € | 710 € (rata iPhone 500, JetCredit 130, debito BBVA 80) |
| Mangiare fuori | 100 € | 153,30 € |
| Carburante | 50 € | 77 € |
| Cura personale | 50 € | 72 € |
| Mezzi pubblici | 39 € | 59 € (ATM 39 + treno Morbegno 20) |
| Abbonamenti digitali | 23 € | 35 € |
| Bar | 10 € | 18,50 € |
| Affitto (novembre) | 565 € | 716 € il 2/11 (affitto vecchio + bollette + caldaia) |

- **Abbonamenti digitali 23 €** è sotto le spese fisse: Spotify 12 + iCloud 1 + Claude 22 = **35 €**. Alza il budget a 35 €.
- **Debiti e rate 282 €**: con JetCredit 130 + debito BBVA 80 + debito Fineco 72 (dal 27/11) sono già **282 €** senza la rata iPhone; ottobre ha avuto anche la 2ª rata iPhone (500 €).
- **"Accantonamento su TR"** (categoria di **uscita**, macro "Risparmi", budget **500 €**) non è mai stata usata. Con la nuova regola il risparmio sono i depositi contrassegnati, non un'uscita: questo budget da 500 € resta sempre "libero" e gonfia il totale dei budget in Home. Ci sono anche tre obiettivi diversi: 400 € (conto risparmio), 500 € (questa categoria), 500 € (macro Risparmi nel piano stipendio di gennaio 2027).
  **Come sistemare:** togli il budget alla categoria (o elimina categoria e macro "Risparmi"), tieni un solo obiettivo in Conti › Impostazioni › Conto risparmio, e nel piano stipendio usa la stessa cifra.
- **Spesa 30 €/mese**: ottobre 29,30 €. Se la spesa la paga spesso Ilaria o in contanti va bene, altrimenti il limite è troppo basso.

### 2.3 Caparre registrate come uscite
- Caparra casa nuova: 1ª rata 500 € (3/10, uscita) e 2ª rata 500 € pianificata il 15/11 da TR.
- Caparra casa vecchia: +580 € pianificati il 4/12 come entrata "Altre entrate".
Una caparra è un credito (prima o poi torna), non una spesa: oggi gonfia le uscite di ottobre e novembre e l'entrata di dicembre.
**Come sistemare (facoltativo):** usa un conto "Da ricevere · Caparra" (Prestiti › Ho prestato) per le caparre versate, e la restituzione come "Mi hanno restituito".

### 2.4 Ricorrenti eliminate con movimenti ancora collegati
Nel cestino (27/10) ci sono i ricorrenti **"Fastweb - Internet" 28 €** e **"Total corner" 26 €**, ma i movimenti del 25/09, 25/10 (Fastweb) e 26/10 (Total corner) li citano ancora. Nessun danno sui saldi; controlla solo che quelle spese siano davvero finite (Fastweb → Iliad? c'è la stima "Iliad spostamento linea"; TotalCorner serve a Bet Tracker), altrimenti non le vedrai più nelle previsioni.

---

## 3. Priorità bassa (pulizia)
- **Rate concluse ancora tra i ricorrenti attivi:** Shein (6,54 € × 3), Ordine shein (29,34 € × 3), Ordine Zalando prive (20,44 € × 3), Treno ritorno Natale (69,33 € × 3, metà a Ilaria): tutte le rate sono pagate (alcune in anticipo il 27/10). L'app non genera più nulla, ma restano in elenco: puoi eliminarle. Aereo Natale Andata ha ancora la 3ª rata il 15/12.
- **27/10, pagamenti anticipati che sembrano doppioni:** Shein 6,54 × 2, Ordine shein 29,34 × 2, Zalando 20,44 × 2, Treno 34,67 × 2 (+ 2 quote di Ilaria da 34,66). Non sono doppioni: sono rate di mesi diversi pagate lo stesso giorno. Nel CSV però non si vede per quale mese era la rata.
- **Conti senza saldo reale mai verificato:** Revolut (157,15 € tutto da vincite "Bet"), Credit Agricole, Poste, Contanti. Fai un controllo una volta (Conti › conto › Modifica).
- **TR e Revolut hanno lo stesso colore** (#5B7553): nella barra dei conti e nelle bolle non si distinguono. Cambia il colore di Revolut.
- **Nessun conto ha l'etichetta** (es. TR "Risparmio", BBVA "Spese quotidiane", Fineco "Stipendio"): nella nuova sezione Conti l'etichetta compare sotto il nome.
- **Wise "−107,28" nel backup non è il saldo:** nel file `balance` è il saldo di partenza dopo le rettifiche registrate "a posteriori"; il saldo vero calcolato è 0,00 €. Nessuna azione.
- **"Rendimento conto TR" 4 €** è in "Rimborsi e cashback": se vuoi distinguerli crea una categoria "Interessi".
- **Emoji:** "Mobili, prodotti, cose per la casa" ne ha tre (🪣🪞🧽, l'icona ne mostra due); la macro "Risparmi" usa 🪎, che su telefoni non aggiornati può non vedersi.
- **Cestino:** 24 elementi (alcuni movimenti di settembre puntano a una categoria che non esiste più); si svuota da solo dopo 90 giorni.
- **"Mocassini zara" (28/09)** ha un campo `planned:false` rimasto da una versione vecchia: innocuo.

## 4. Cose controllate e in ordine
- **Prestiti:** Da ricevere · Ilaria **111,27 €** = esattamente le tre rate di Natale pagate in anticipo il 27/10 (34,66 + 41,95 + 34,66); il resto (giubbotto, Ikea, macchina caffè, Amazon, vecchi 213,80 €) è stato restituito (287,85 + 76,61) o compensato (60 + 25). Da pagare · Ilaria **0,00 €** (98,50 € pagati da lei − 85 compensati − 13,50 restituiti). "Ordine shein" archiviato a 0.
- **Contanti:** prelievo 100 + 30 iniziali, spese 130 → 0,00 € coerente.
- **Ricorrenti attivi** coerenti con i movimenti (Spotify, iCloud, ATM, Fastweb linea, Costo carta, Debito BBVA); nuovi Claude 22 € dal 22/11 e Debito Fineco 72 € dal 27/11.
- **Stime di novembre** (7 voci, 1.000 €) e piano stipendio gennaio 2027: struttura corretta.

## 5. Correzioni automatiche possibili (NON applicate: servono il tuo ok)
Si possono fare con una migrazione una tantum all'avvio, senza toccare i saldi:
1. Trasformare le 4 entrate "Stipendio" senza nome del 21-22/09 (753,65 €) in Rettifica saldo → settembre torna a 2.069,40 € di entrate.
2. Togliere il budget 500 € dalla categoria "Accantonamento su TR" (o eliminarla con la macro "Risparmi" se non la usi).
3. Spostare il ricorrente JetCredit su Credit Agricole (solo se confermi che esce da lì).
Le altre (affitto su Fineco/BBVA, stipendio di novembre, saldo Poste, vincite non registrate) richiedono che tu controlli la banca: vanno fatte a mano.

## 6. Note tecniche sul codice (trovate durante l'analisi)
- Eliminando un conto si cancellano i movimenti con quel conto come origine, ma non i trasferimenti che lo hanno come **destinazione**: restano movimenti verso "Conto eliminato". Da sistemare in una prossima versione.
- In `app.js` le funzioni `shortDate` e `isoAddDays` sono definite due volte con formati diversi: vale l'ultima (date tipo "01/11"). Innocuo oggi, ma va unificato.
