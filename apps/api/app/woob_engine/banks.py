"""
OmniFlow — Supported banks list (Woob modules for France).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BankInfo:
    module: str
    name: str
    logo_url: str
    fields: list[dict]  # [{id, label, type, placeholder, pattern?, choices?}]
    sca_type: str
    # Extra woob params to always send (e.g. defaults for optional fields)
    default_params: dict | None = None


# ── All logos are real PNGs stored in apps/web/public/banks/<module>.png ──────
# They come from woob's icon repository + Google favicon service.

SUPPORTED_BANKS: list[BankInfo] = [
    # ── Major French banks ───────────────────────────────────────────────
    BankInfo(
        module="bnp",
        name="BNP Paribas",
        logo_url="/banks/bnp.png",
        fields=[
            {"id": "login", "label": "Numéro client", "type": "text", "placeholder": "Votre numéro client"},
            {"id": "password", "label": "Code secret", "type": "password", "placeholder": "6 chiffres", "pattern": "^\\d{6}$"},
        ],
        sca_type="cle_digitale",
        default_params={"website": "pp"},
    ),
    BankInfo(
        module="boursorama",
        name="Boursorama Banque",
        logo_url="/banks/boursorama.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Numéro client (chiffres)", "pattern": "^[0-9]+$"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="societegenerale",
        name="Société Générale",
        logo_url="/banks/societegenerale.png",
        fields=[
            {"id": "login", "label": "Code client", "type": "text", "placeholder": "Votre code client"},
            {"id": "password", "label": "Code secret", "type": "password", "placeholder": "6 chiffres"},
        ],
        sca_type="app_mobile",
        default_params={"website": "par"},
    ),
    BankInfo(
        module="creditmutuel",
        name="Crédit Mutuel",
        logo_url="/banks/creditmutuel.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp",
    ),
    BankInfo(
        module="cragr",
        name="Crédit Agricole",
        logo_url="/banks/cragr.png",
        fields=[
            {"id": "website", "label": "Caisse Régionale", "type": "select", "placeholder": "Sélectionnez votre caisse régionale", "choices": {
                "www.ca-alpesprovence.fr": "Alpes Provence",
                "www.ca-alsace-vosges.fr": "Alsace-Vosges",
                "www.ca-anjou-maine.fr": "Anjou Maine",
                "www.ca-aquitaine.fr": "Aquitaine",
                "www.ca-atlantique-vendee.fr": "Atlantique Vendée",
                "www.ca-briepicardie.fr": "Brie Picardie",
                "www.ca-cb.fr": "Champagne Bourgogne",
                "www.ca-centrefrance.fr": "Centre France",
                "www.ca-centreloire.fr": "Centre Loire",
                "www.ca-centreouest.fr": "Centre Ouest",
                "www.ca-centrest.fr": "Centre Est",
                "www.ca-charente-perigord.fr": "Charente Périgord",
                "www.ca-cmds.fr": "Charente-Maritime Deux-Sèvres",
                "www.ca-corse.fr": "Corse",
                "www.ca-cotesdarmor.fr": "Côtes d'Armor",
                "www.ca-des-savoie.fr": "Des Savoie",
                "www.ca-finistere.fr": "Finistère",
                "www.ca-franchecomte.fr": "Franche-Comté",
                "www.ca-guadeloupe.fr": "Guadeloupe",
                "www.ca-illeetvilaine.fr": "Ille-et-Vilaine",
                "www.ca-languedoc.fr": "Languedoc",
                "www.ca-loirehauteloire.fr": "Loire Haute Loire",
                "www.ca-lorraine.fr": "Lorraine",
                "www.ca-martinique.fr": "Martinique Guyane",
                "www.ca-morbihan.fr": "Morbihan",
                "www.ca-nmp.fr": "Nord Midi-Pyrénées",
                "www.ca-nord-est.fr": "Nord Est",
                "www.ca-norddefrance.fr": "Nord de France",
                "www.ca-normandie-seine.fr": "Normandie Seine",
                "www.ca-normandie.fr": "Normandie",
                "www.ca-paris.fr": "Île-de-France",
                "www.ca-pca.fr": "Provence Côte d'Azur",
                "www.ca-pyrenees-gascogne.fr": "Pyrénées Gascogne",
                "www.ca-reunion.fr": "Réunion",
                "www.ca-sudmed.fr": "Sud Méditerranée",
                "www.ca-sudrhonealpes.fr": "Sud Rhône Alpes",
                "www.ca-toulouse31.fr": "Toulouse 31",
                "www.ca-tourainepoitou.fr": "Tourraine Poitou",
                "www.ca-valdefrance.fr": "Val de France",
            }},
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "11 chiffres", "pattern": "^\\d{11}$"},
            {"id": "password", "label": "Code personnel", "type": "password", "placeholder": "6 chiffres", "pattern": "^\\d{6}$"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="caissedepargne",
        name="Caisse d'Épargne",
        logo_url="/banks/caissedepargne.png",
        fields=[
            {"id": "login", "label": "Identifiant client", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Code (chiffres)", "pattern": "^\\d+$"},
        ],
        sca_type="securipass",
    ),
    BankInfo(
        module="lcl",
        name="LCL",
        logo_url="/banks/lcl.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Code personnel", "type": "password", "placeholder": "Votre code personnel"},
        ],
        sca_type="app_mobile",
        default_params={"website": "par"},
    ),
    BankInfo(
        module="bp",
        name="La Banque Postale",
        logo_url="/banks/bp.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "10 chiffres", "pattern": "^\\d{10}[a-zA-Z0-9]?$"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "6 chiffres", "pattern": "^\\d{6}$"},
        ],
        sca_type="certicode_plus",
        default_params={"website": "par"},
    ),
    BankInfo(
        module="cic",
        name="CIC",
        logo_url="/banks/cic.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp",
    ),
    BankInfo(
        module="fortuneo",
        name="Fortuneo",
        logo_url="/banks/fortuneo.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="hellobank",
        name="Hello Bank!",
        logo_url="/banks/hellobank.png",
        fields=[
            {"id": "login", "label": "Numéro client", "type": "text", "placeholder": "Votre numéro client"},
            {"id": "password", "label": "Code secret", "type": "password", "placeholder": "6 chiffres", "pattern": "^\\d{6}$"},
        ],
        sca_type="cle_digitale",
        default_params={"website": "hbank"},
    ),
    # ── Banque Populaire (régions) ───────────────────────────────────────
    BankInfo(
        module="banquepopulaire",
        name="Banque Populaire",
        logo_url="/banks/banquepopulaire.png",
        fields=[
            {"id": "cdetab", "label": "Région", "type": "select", "placeholder": "Sélectionnez votre région", "choices": {
                "14707": "Alsace Lorraine Champagne",
                "10907": "Aquitaine Centre Atlantique",
                "16807": "Auvergne Rhône Alpes",
                "10807": "Bourgogne Franche-Comté",
                "13807": "Grand Ouest",
                "14607": "Méditerranée",
                "13507": "Nord",
                "17807": "Occitane",
                "10207": "Rives de Paris",
                "16607": "Sud",
                "18707": "Val de France",
            }},
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant", "pattern": "^[a-zA-Z0-9]+$"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    # ── Online / Neo banks ───────────────────────────────────────────────
    BankInfo(
        module="bforbank",
        name="BforBank",
        logo_url="/banks/bforbank.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Code personnel", "type": "password", "placeholder": "Chiffres uniquement", "pattern": "^\\d+$"},
            {"id": "birthdate", "label": "Date de naissance", "type": "text", "placeholder": "JJ/MM/AAAA"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="ing",
        name="ING",
        logo_url="/banks/ing.png",
        fields=[
            {"id": "login", "label": "Numéro client", "type": "text", "placeholder": "Numéro client (chiffres)", "pattern": "^\\d{1,10}$"},
            {"id": "password", "label": "Code secret", "type": "password", "placeholder": "6 chiffres", "pattern": "^\\d{6}$"},
            {"id": "birthday", "label": "Date de naissance", "type": "text", "placeholder": "JJ/MM/AAAA"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="n26",
        name="N26",
        logo_url="/banks/n26.png",
        fields=[
            {"id": "login", "label": "Email", "type": "text", "placeholder": "Votre adresse email"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="app_mobile",
    ),
    BankInfo(
        module="helios",
        name="Helios",
        logo_url="/banks/helios.png",
        fields=[
            {"id": "login", "label": "Email", "type": "text", "placeholder": "Votre adresse email"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp",
    ),
    BankInfo(
        module="greengot",
        name="Green-Got",
        logo_url="/banks/greengot.png",
        fields=[
            {"id": "login", "label": "Email", "type": "text", "placeholder": "Votre adresse email"},
        ],
        sca_type="otp",
    ),
    BankInfo(
        module="orangebank",
        name="Orange Bank",
        logo_url="/banks/orangebank.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "8 chiffres", "pattern": "^[0-9]{8}$"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="mafrenchbank",
        name="Ma French Bank",
        logo_url="/banks/mafrenchbank.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    # ── Regional / Mutualiste ────────────────────────────────────────────
    BankInfo(
        module="bred",
        name="BRED",
        logo_url="/banks/bred.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="cmb",
        name="Crédit Mutuel de Bretagne",
        logo_url="/banks/cmb.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp",
        default_params={"website": "par"},
    ),
    BankInfo(
        module="cmso",
        name="Crédit Mutuel Sud-Ouest",
        logo_url="/banks/cmso.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp",
        default_params={"website": "par"},
    ),
    BankInfo(
        module="creditcooperatif",
        name="Crédit Coopératif",
        logo_url="/banks/creditcooperatif.png",
        fields=[
            {"id": "login", "label": "Identifiant client", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Code (chiffres)", "pattern": "^\\d+$"},
        ],
        sca_type="securipass",
    ),
    BankInfo(
        module="creditdunord",
        name="Crédit du Nord",
        logo_url="/banks/creditdunord.png",
        fields=[
            {"id": "website", "label": "Banque", "type": "select", "placeholder": "Sélectionnez votre banque", "choices": {
                "www.credit-du-nord.fr": "Crédit du Nord",
                "www.banque-courtois.fr": "Banque Courtois",
                "www.banque-kolb.fr": "Banque Kolb",
                "www.banque-laydernier.fr": "Banque Laydernier",
                "www.banque-nuger.fr": "Banque Nuger",
                "www.banque-rhone-alpes.fr": "Banque Rhône-Alpes",
                "www.smc.fr": "Société Marseillaise de Crédit",
                "www.tarneaud.fr": "Tarneaud",
            }},
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Code confidentiel", "type": "password", "placeholder": "Votre code"},
        ],
        sca_type="otp_sms",
    ),
    # ── Insurance / Other banks ──────────────────────────────────────────
    BankInfo(
        module="axabanque",
        name="AXA Banque",
        logo_url="/banks/axabanque.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="allianzbanque",
        name="Allianz Banque",
        logo_url="/banks/allianzbanque.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="ganassurances",
        name="Gan Assurances",
        logo_url="/banks/ganassurances.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp",
    ),
    BankInfo(
        module="groupama",
        name="Groupama",
        logo_url="/banks/groupama.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp",
    ),
    BankInfo(
        module="milleis",
        name="Milleis Banque",
        logo_url="/banks/milleis.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    # ── CCF (ex-HSBC France) ─────────────────────────────────────────────
    BankInfo(
        module="ccf",
        name="CCF (ex-HSBC)",
        logo_url="/banks/ccf.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "9 chiffres", "pattern": "^\\d{9}$"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "8 chiffres", "pattern": "^\\d{8}$"},
            {"id": "security_code", "label": "Code de sécurité", "type": "password", "placeholder": "5 chiffres", "pattern": "^\\d{5}$"},
        ],
        sca_type="otp",
        default_params={"website": "par"},
    ),
    # ── Retail / Cards ───────────────────────────────────────────────────
    BankInfo(
        module="carrefourbanque",
        name="Carrefour Banque",
        logo_url="/banks/carrefourbanque.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="banqueaccord",
        name="Banque Accord (Auchan)",
        logo_url="/banks/banqueaccord.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="oney",
        name="Oney Banque",
        logo_url="/banks/oney.png",
        fields=[
            {"id": "login", "label": "Identifiant", "type": "text", "placeholder": "Votre identifiant"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    BankInfo(
        module="paypal",
        name="PayPal",
        logo_url="/banks/paypal.png",
        fields=[
            {"id": "login", "label": "Email", "type": "text", "placeholder": "Votre email PayPal"},
            {"id": "password", "label": "Mot de passe", "type": "password", "placeholder": "Votre mot de passe"},
        ],
        sca_type="otp_sms",
    ),
    # ── Trade Republic (custom API, not Woob) ────────────────────────────
    BankInfo(
        module="traderepublic",
        name="Trade Republic",
        logo_url="/banks/traderepublic.png",
        fields=[
            {"id": "phone_number", "label": "Numéro de téléphone", "type": "tel", "placeholder": "+33 6 12 34 56 78"},
            {"id": "pin", "label": "Code PIN", "type": "password", "placeholder": "Code PIN à 4 chiffres"},
        ],
        sca_type="app_2fa",
    ),
]


# Trade Republic uses its own API, not Woob
CUSTOM_BANK_MODULES = {"traderepublic"}


def is_custom_module(module: str) -> bool:
    """Check if a bank module uses a custom API (not Woob)."""
    return module in CUSTOM_BANK_MODULES


def get_bank_info(module: str) -> BankInfo | None:
    return next((b for b in SUPPORTED_BANKS if b.module == module), None)


def get_all_banks() -> list[dict]:
    """Return serializable list for the GET /banks endpoint."""
    return [
        {
            "module": b.module,
            "name": b.name,
            "logo_url": b.logo_url,
            "fields": b.fields,
            "sca_type": b.sca_type,
        }
        for b in SUPPORTED_BANKS
    ]
