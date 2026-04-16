import pandas as pd

try:
    # Try different encodings
    df = pd.read_csv("dataset.csv", encoding="ISO-8859-1", on_bad_lines="skip")

    # Save cleaned file
    df.to_csv("dataset_utf8.csv", index=False, encoding="utf-8")

    print("File cleaned and saved as dataset_utf8.csv")

except Exception as e:
    print(f"Error while reading CSV: {e}")
