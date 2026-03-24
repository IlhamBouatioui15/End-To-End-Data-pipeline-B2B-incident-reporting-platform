from sqlalchemy.orm import Session
from passlib.context import CryptContext
from main import SessionLocal, User, Base, engine 

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=12,
    bcrypt__ident="2b"  # Force l'utilisation du bon identifiant de hash
)

def create_initial_admin():
    db: Session = SessionLocal()
    Base.metadata.create_all(bind=engine)  # au cas où la table n'existe pas encore

    username = "admin"
    password = "admin123"
    

    hashed_password = pwd_context.hash(password)

    existing = db.query(User).filter(User.username == username).first()
    if not existing:
        admin = User(username=username, hashed_password=hashed_password, role="admin")
        db.add(admin)
        db.commit()
        print("✅ Admin créé avec succès !")
    else:
        print("⚠️ L'utilisateur admin existe déjà.")

    db.close()

create_initial_admin()
