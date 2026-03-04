"""
OmniFlow — Rule-based transaction categorizer for French banks.

150+ regex patterns covering French merchants, recurring payments, and
financial operations. Categories assigned automatically after each sync.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

from app.woob_engine.normalizer import NormalizedTransaction


@dataclass(frozen=True)
class CategoryRule:
    pattern: str       # regex (case-insensitive)
    category: str
    subcategory: str
    merchant: str | None = None
    is_recurring: bool = False


# ── 15 catégories × sous-catégories ───────────────────────────

RULES: list[CategoryRule] = [
    # ── ALIMENTATION ──────────────────────────────────
    CategoryRule(r"\bcarrefour\b", "Alimentation", "Courses", "Carrefour"),
    CategoryRule(r"\bleclerc\b", "Alimentation", "Courses", "E.Leclerc"),
    CategoryRule(r"\bauchan\b", "Alimentation", "Courses", "Auchan"),
    CategoryRule(r"\blidl\b", "Alimentation", "Courses", "Lidl"),
    CategoryRule(r"\bmonoprix\b", "Alimentation", "Courses", "Monoprix"),
    CategoryRule(r"\bfranprix\b", "Alimentation", "Courses", "Franprix"),
    CategoryRule(r"\bintermarche\b|inter\s*march", "Alimentation", "Courses", "Intermarché"),
    CategoryRule(r"\bcasino\b", "Alimentation", "Courses", "Casino"),
    CategoryRule(r"\bpicard\b", "Alimentation", "Courses", "Picard"),
    CategoryRule(r"\bnaturalia\b", "Alimentation", "Courses", "Naturalia"),
    CategoryRule(r"\bbiocoop\b", "Alimentation", "Courses", "Biocoop"),
    CategoryRule(r"\bgrand\s*frais\b", "Alimentation", "Courses", "Grand Frais"),
    CategoryRule(r"\bsuper\s*u\b|\bmagasin\s*u\b|\bhyper\s*u\b", "Alimentation", "Courses", "Super U"),
    CategoryRule(r"\bmcdo|mcdonald|mac\s*do\b", "Alimentation", "Fast-food", "McDonald's"),
    CategoryRule(r"\bburger\s*king\b", "Alimentation", "Fast-food", "Burger King"),
    CategoryRule(r"\bkfc\b", "Alimentation", "Fast-food", "KFC"),
    CategoryRule(r"\bsubway\b", "Alimentation", "Fast-food", "Subway"),
    CategoryRule(r"\bdomino|pizza\s*hut\b", "Alimentation", "Fast-food"),
    CategoryRule(r"\bboulangerie|boulang\b", "Alimentation", "Boulangerie"),
    CategoryRule(r"\brestaurant|resto\b|traiteur", "Alimentation", "Restaurant"),
    CategoryRule(r"\buber\s*eats|deliveroo|just\s*eat\b", "Alimentation", "Livraison", is_recurring=False),
    CategoryRule(r"\bstarbucks\b", "Alimentation", "Café", "Starbucks"),

    # ── TRANSPORT ─────────────────────────────────────
    CategoryRule(r"\bsncf\b|tgv|ouigo|ter\b", "Transport", "Train", "SNCF"),
    CategoryRule(r"\bratp\b|metro|navigo", "Transport", "Transport en commun", "RATP"),
    CategoryRule(r"\buber\b(?!.*eats)", "Transport", "VTC", "Uber"),
    CategoryRule(r"\bbolt\b", "Transport", "VTC", "Bolt"),
    CategoryRule(r"\bheetch\b", "Transport", "VTC", "Heetch"),
    CategoryRule(r"\bblablacar\b", "Transport", "Covoiturage", "BlaBlaCar"),
    CategoryRule(r"\btotalenergies|total\s|shell\b|bp\s|esso\b|avia\b", "Transport", "Essence"),
    CategoryRule(r"\bpeage|autoroute|sanef|vinci\s*auto\b|aprr\b", "Transport", "Péages"),
    CategoryRule(r"\bparking|indigo|effia\b|saemes\b", "Transport", "Parking"),
    CategoryRule(r"\blime\b|bird\b|tier\b|dott\b", "Transport", "Trottinette"),
    CategoryRule(r"\bvelib|velo\b", "Transport", "Vélo"),
    CategoryRule(r"\bair\s*france|easyjet|ryanair|vueling|transavia\b", "Transport", "Avion"),

    # ── LOGEMENT ──────────────────────────────────────
    CategoryRule(r"\bloyer\b|bailleur|agence\s*immob", "Logement", "Loyer", is_recurring=True),
    CategoryRule(r"\bcharges?\s*(de\s*)?copro", "Logement", "Charges copro", is_recurring=True),
    CategoryRule(r"\btaxe\s*(d.)?habitation\b", "Logement", "Taxe habitation"),
    CategoryRule(r"\btaxe\s*fonciere\b", "Logement", "Taxe foncière"),
    CategoryRule(r"\bassurance\s*(habitation|logement|maison)", "Logement", "Assurance habitation", is_recurring=True),
    CategoryRule(r"\bikea\b", "Logement", "Ameublement", "IKEA"),
    CategoryRule(r"\bleroy\s*merlin|castorama|brico|mr\s*bricolage\b", "Logement", "Bricolage"),
    CategoryRule(r"\bmaisons\s*du\s*monde|alinea|but\b", "Logement", "Ameublement"),

    # ── ÉNERGIE ───────────────────────────────────────
    CategoryRule(r"\bedf\b|electricite\s*de\s*france|engie\b|gdf\b", "Énergie", "Électricité/Gaz", is_recurring=True),
    CategoryRule(r"\bveolia|eau\s*de\s*paris|suez\b", "Énergie", "Eau", is_recurring=True),
    CategoryRule(r"\btotal\s*energies?\s*elec|ekwateur|eni\b|planete\s*oui\b", "Énergie", "Électricité/Gaz", is_recurring=True),

    # ── TÉLÉCOM ───────────────────────────────────────
    CategoryRule(r"\bfree\s*(mobile)?\b|iliad\b", "Télécom", "Mobile/Internet", "Free", True),
    CategoryRule(r"\borange\b|sosh\b", "Télécom", "Mobile/Internet", "Orange", True),
    CategoryRule(r"\bsfr\b|red\s*by\s*sfr\b", "Télécom", "Mobile/Internet", "SFR", True),
    CategoryRule(r"\bbouygues?\s*tel\b|b&you\b", "Télécom", "Mobile/Internet", "Bouygues", True),
    CategoryRule(r"\bovh\b", "Télécom", "Hébergement", "OVH", True),

    # ── ABONNEMENTS ───────────────────────────────────
    CategoryRule(r"\bnetflix\b", "Abonnements", "Streaming", "Netflix", True),
    CategoryRule(r"\bspotify\b", "Abonnements", "Musique", "Spotify", True),
    CategoryRule(r"\bdeezer\b", "Abonnements", "Musique", "Deezer", True),
    CategoryRule(r"\bamazon\s*prime|amzn\s*prime\b", "Abonnements", "Streaming", "Amazon Prime", True),
    CategoryRule(r"\bdisney\+|disneyplus\b", "Abonnements", "Streaming", "Disney+", True),
    CategoryRule(r"\bcanal\+|canal\s*plus\b", "Abonnements", "Streaming", "Canal+", True),
    CategoryRule(r"\bapple\s*(music|tv|one|icloud)\b", "Abonnements", "Apple", "Apple", True),
    CategoryRule(r"\bgoogle\s*(one|storage|cloud)\b", "Abonnements", "Cloud", "Google", True),
    CategoryRule(r"\bmicrosoft\s*365|office\s*365\b", "Abonnements", "Logiciel", "Microsoft", True),
    CategoryRule(r"\badobe\b", "Abonnements", "Logiciel", "Adobe", True),
    CategoryRule(r"\bchatgpt|openai\b", "Abonnements", "IA", "OpenAI", True),
    CategoryRule(r"\byoutube\s*premium\b", "Abonnements", "Streaming", "YouTube", True),
    CategoryRule(r"\bplaystation\s*plus|ps\s*plus|xbox\b", "Abonnements", "Gaming", is_recurring=True),
    CategoryRule(r"\bsalle\s*de\s*sport|fitness|basic\s*fit|gymlib\b", "Abonnements", "Sport", is_recurring=True),

    # ── SHOPPING ──────────────────────────────────────
    CategoryRule(r"\bamazon\b(?!.*prime)", "Shopping", "E-commerce", "Amazon"),
    CategoryRule(r"\bcdiscount\b", "Shopping", "E-commerce", "Cdiscount"),
    CategoryRule(r"\bfnac\b", "Shopping", "Culture/Tech", "Fnac"),
    CategoryRule(r"\bdarty\b", "Shopping", "Électroménager", "Darty"),
    CategoryRule(r"\bboulanger\b", "Shopping", "Électroménager", "Boulanger"),
    CategoryRule(r"\bzara\b|h&m|hm\b|primark|kiabi\b|uniqlo\b", "Shopping", "Vêtements"),
    CategoryRule(r"\bdecathlon\b", "Shopping", "Sport", "Décathlon"),
    CategoryRule(r"\baction\b|gifi\b|centrakor\b", "Shopping", "Maison/Déco"),
    CategoryRule(r"\bsephora|nocibe|marionnaud\b", "Shopping", "Beauté"),
    CategoryRule(r"\baliexpress|shein|temu\b", "Shopping", "E-commerce"),
    CategoryRule(r"\bleboncoin\b|vinted\b", "Shopping", "Occasion"),

    # ── SANTÉ ─────────────────────────────────────────
    CategoryRule(r"\bpharmacie|pharmacie\b", "Santé", "Pharmacie"),
    CategoryRule(r"\bmedecin|docteur|dr\b|cabinet\s*medical", "Santé", "Médecin"),
    CategoryRule(r"\bdentiste|chirurgien\s*dent\b", "Santé", "Dentiste"),
    CategoryRule(r"\bopticien|optique|krys|afflelou\b", "Santé", "Optique"),
    CategoryRule(r"\bhopital|clinique|urgence\b", "Santé", "Hôpital"),
    CategoryRule(r"\bmutuelle|cpam|ameli|secu\b", "Santé", "Assurance santé", is_recurring=True),
    CategoryRule(r"\blaboratoire|labo\s*analyse\b", "Santé", "Laboratoire"),

    # ── LOISIRS ───────────────────────────────────────
    CategoryRule(r"\bcinema|ugc|pathe|gaumont|mk2\b", "Loisirs", "Cinéma"),
    CategoryRule(r"\bmusee|exposition|galerie\b", "Loisirs", "Culture"),
    CategoryRule(r"\btheatre|concert|spectacle|zenith|olympia\b", "Loisirs", "Spectacle"),
    CategoryRule(r"\bhotel|airbnb|booking\.com|abritel\b", "Loisirs", "Hébergement"),
    CategoryRule(r"\bclub\s*med|center\s*parcs|pierre\s*et\s*vacances\b", "Loisirs", "Vacances"),
    CategoryRule(r"\bjeux|steam|playstation|nintendo|xbox|epic\s*games\b", "Loisirs", "Gaming"),

    # ── BANQUE / FINANCE ──────────────────────────────
    CategoryRule(r"\bfrais\s*(bancaire|tenu|compte|carte)\b|commission", "Banque", "Frais bancaires"),
    CategoryRule(r"\bagios?\b|interet\s*debiteur\b", "Banque", "Agios"),
    CategoryRule(r"\bassurance\s*(carte|moyen|paiement)\b", "Banque", "Assurance carte", is_recurring=True),
    CategoryRule(r"\bcotisation\s*carte\b", "Banque", "Cotisation carte", is_recurring=True),
    CategoryRule(r"\bvirement\s*(emis|recu|permanent)\b", "Banque", "Virement"),
    CategoryRule(r"\bpret\s*immobilier|credit\s*immobilier|echeance\s*pret\b", "Banque", "Crédit immobilier", is_recurring=True),
    CategoryRule(r"\bcredit\s*conso|pret\s*personnel\b", "Banque", "Crédit conso", is_recurring=True),

    # ── REVENUS ───────────────────────────────────────
    CategoryRule(r"\bsalaire|paie|remuneration\b|vir\s*employeur\b", "Revenus", "Salaire", is_recurring=True),
    CategoryRule(r"\bprime\b|bonus\b|interessement|participation\b", "Revenus", "Prime"),
    CategoryRule(r"\ballocation|caf\b|apl\b|rsa\b", "Revenus", "Aides sociales", is_recurring=True),
    CategoryRule(r"\bpension|retraite\b", "Revenus", "Pension/Retraite", is_recurring=True),
    CategoryRule(r"\bdividende\b", "Revenus", "Dividendes"),
    CategoryRule(r"\bloyer\s*recu|encaissement\s*loyer\b", "Revenus", "Loyers perçus"),
    CategoryRule(r"\bremboursement|rbt\b", "Revenus", "Remboursement"),

    # ── ÉPARGNE ───────────────────────────────────────
    CategoryRule(r"\blivret\s*a\b|livret\s*dev\b|ldd\b|ldds\b", "Épargne", "Livret réglementé"),
    CategoryRule(r"\bpel\b|plan\s*epargne\s*logement\b", "Épargne", "PEL"),
    CategoryRule(r"\bassurance\s*vie\b|av\b", "Épargne", "Assurance vie"),
    CategoryRule(r"\bpea\b|plan\s*epargne\s*actions\b", "Épargne", "PEA"),
    CategoryRule(r"\bper\b|plan\s*epargne\s*retraite\b", "Épargne", "PER"),

    # ── IMPÔTS ────────────────────────────────────────
    CategoryRule(r"\bimpot\s*(sur\s*le\s*)?revenu\b|dgfip\b|tresor\s*public\b", "Impôts", "Impôt sur le revenu"),
    CategoryRule(r"\bcsg\b|crds\b|prelevements?\s*sociaux?\b", "Impôts", "Prélèvements sociaux"),

    # ── ÉDUCATION ─────────────────────────────────────
    CategoryRule(r"\buniversite|ecole|scolarite|inscription\s*scolaire\b", "Éducation", "Scolarité"),
    CategoryRule(r"\bformation|udemy|coursera|openclassrooms\b", "Éducation", "Formation en ligne"),
    CategoryRule(r"\blibrairie|livre|gibert\b|cultura\b", "Éducation", "Livres"),

    # ── RETRAIT ───────────────────────────────────────
    CategoryRule(r"\bretrait\b|dab\b|distrib.*billet\b|atm\b", "Cash", "Retrait DAB"),
]

# Compiled patterns for performance
_COMPILED_RULES: list[tuple[re.Pattern, CategoryRule]] = [
    (re.compile(r.pattern, re.IGNORECASE), r) for r in RULES
]


def categorize_transaction(txn: NormalizedTransaction) -> NormalizedTransaction:
    """
    Apply rule-based categorization to a single transaction.
    Matches against label + raw_label. First match wins.
    Returns a new NormalizedTransaction with category/subcategory/merchant filled.
    """
    text = f"{txn.label} {txn.raw_label or ''}"

    for compiled, rule in _COMPILED_RULES:
        if compiled.search(text):
            return NormalizedTransaction(
                external_id=txn.external_id,
                date=txn.date,
                amount=txn.amount,
                label=txn.label,
                raw_label=txn.raw_label,
                type=txn.type,
                category=rule.category,
                subcategory=rule.subcategory,
                merchant=rule.merchant or txn.merchant,
                is_recurring=rule.is_recurring or txn.is_recurring,
            )

    # No match — mark as "Autres"
    return NormalizedTransaction(
        external_id=txn.external_id,
        date=txn.date,
        amount=txn.amount,
        label=txn.label,
        raw_label=txn.raw_label,
        type=txn.type,
        category="Autres",
        subcategory="Non catégorisé",
        merchant=txn.merchant,
        is_recurring=txn.is_recurring,
    )


def categorize_batch(txns: Sequence[NormalizedTransaction]) -> list[NormalizedTransaction]:
    """Categorize a batch of transactions."""
    return [categorize_transaction(t) for t in txns]


# ── Category metadata for UI ────────────────────────────────────
CATEGORY_COLORS: dict[str, str] = {
    "Alimentation": "#4CAF50",
    "Transport": "#2196F3",
    "Logement": "#9C27B0",
    "Énergie": "#FF9800",
    "Télécom": "#00BCD4",
    "Abonnements": "#E91E63",
    "Shopping": "#FF5722",
    "Santé": "#F44336",
    "Loisirs": "#8BC34A",
    "Banque": "#607D8B",
    "Revenus": "#4CAF50",
    "Épargne": "#3F51B5",
    "Impôts": "#795548",
    "Éducation": "#009688",
    "Cash": "#FFC107",
    "Autres": "#9E9E9E",
}

CATEGORY_ICONS: dict[str, str] = {
    "Alimentation": "shopping-cart",
    "Transport": "car",
    "Logement": "home",
    "Énergie": "zap",
    "Télécom": "smartphone",
    "Abonnements": "repeat",
    "Shopping": "shopping-bag",
    "Santé": "heart",
    "Loisirs": "music",
    "Banque": "landmark",
    "Revenus": "trending-up",
    "Épargne": "piggy-bank",
    "Impôts": "file-text",
    "Éducation": "book-open",
    "Cash": "banknote",
    "Autres": "help-circle",
}
