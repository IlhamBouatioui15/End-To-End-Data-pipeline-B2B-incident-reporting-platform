"""
import datetime as _dt
import pydantic as _pydantic
from pydantic import BaseModel
class _UserBase(_pydantic.BaseModel):
    email:str


class UserCreate(BaseModel):
        email: str
        password: str
 
        

class User(_UserBase):
    id:int
    model_config = {\"from_attributes\": True}
        
class _leadBase(_pydantic.BaseModel):
    first_name:str
    last_name:str
    email:str
    role:str
    
class LeadCreate(_leadBase):
    pass

class Lead(_leadBase):
    id:int
    owner_id:int
    date_created:_dt.datetime
    class Config:
        orm_mode = True
    
""" 
import datetime as _dt

import pydantic as _pydantic


class _UserBase(_pydantic.BaseModel):
    email: str


class UserCreate(_UserBase):
    hashed_password: str

    model_config = {"from_attributes": True}


class User(_UserBase):
    id: int

    model_config = {"from_attributes": True}


class _LeadBase(_pydantic.BaseModel):
    first_name: str
    last_name: str
    email: str
    company: str
    note: str


class LeadCreate(_LeadBase):
    pass


class Lead(_LeadBase):
    id: int
    owner_id: int
    date_created: _dt.datetime
    date_last_updated: _dt.datetime

    model_config = {"from_attributes": True}
       
from pydantic import BaseModel
from typing import List, Dict, Any

class LigneModifiee(BaseModel):
    oldRow: Dict[str, Any]
    newRow: Dict[str, Any]

class ModificationRequest(BaseModel):
    utilisateur: str
    old_row: dict  # JSON reçu depuis React
    new_row: dict   # JSON reçu depuis React

class BulkModificationRequest(BaseModel):
    modifications: List[ModificationRequest]
