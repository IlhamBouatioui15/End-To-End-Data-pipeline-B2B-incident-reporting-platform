

from sqlalchemy import JSON, TIMESTAMP, Column, Integer, String, Boolean, Float, text
from database import Base
from database import engine


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="membre")  # 'admin' ou 'membre'

User.metadata.create_all(bind=engine)

class Members(Base):
    __tablename__ = 'Members'

    id = Column(Integer, primary_key=True, index=True)
    
    First_name = Column(String)
    Last_name = Column(String)
    Role = Column(String)
    Username = Column(String, unique=True, index=True)
    password = Column(String)
    
class TicketModificationPending(Base):
    __tablename__ = "tickets_modification_pending"

    id              = Column(Integer, primary_key=True, index=True)
    utilisateur     = Column(String, nullable=False)
    old_row         = Column(JSON, nullable=False)
    new_row         = Column(JSON, nullable=False)
    date_modification = Column(TIMESTAMP, server_default=text("NOW()"))
    status          = Column(String, default="pending")


