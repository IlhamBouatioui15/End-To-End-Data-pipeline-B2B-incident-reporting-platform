import os
from dotenv import load_dotenv

load_dotenv()
def fetch_excel_from_email():
    import imaplib, email, os
    from email.header import decode_header

    IMAP_SERVER = os.getenv("IMAP_SERVER")
    EMAIL_login= os.getenv("EMAIL")
    PASSWORD_login = os.getenv("PASSWORD")

    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL_login, PASSWORD_login)
    mail.select("inbox")

    status, messages = mail.search(None, 'UNSEEN')
    email_ids = messages[0].split()

    for email_id in email_ids:
        res, msg_data = mail.fetch(email_id, "(RFC822)")
        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])
                subject = decode_header(msg["Subject"])[0][0]
                if isinstance(subject, bytes):
                    subject = subject.decode()
                print(f"Email reçu : {subject}")

                for part in msg.walk():
                    if part.get_content_disposition() == "attachment":
                        filename = part.get_filename()
                        if filename and filename.endswith(".xlsx"):
                            os.makedirs("fichiers_reçus", exist_ok=True)
                            filepath = os.path.join("fichiers_reçus", filename)
                            with open(filepath, "wb") as f:
                                f.write(part.get_payload(decode=True))
                            print(f"✅ Fichier téléchargé : {filename}")
        mail.store(email_id, '+FLAGS', '\\Seen')
    mail.logout()
if __name__ == "__main__":
    fetch_excel_from_email() 
