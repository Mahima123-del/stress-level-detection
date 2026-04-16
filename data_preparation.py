import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score
import nltk
from nltk.corpus import stopwords
import joblib

# Download NLTK stopwords if not already installed
nltk.download('stopwords')

# Step 1: Load the data
df = pd.read_csv('Reddit_Title.csv', sep=';')  # Adjust the file name and separator

# Step 2: Drop any unnecessary columns (if any)
# Drop empty columns
df.dropna(axis=1, how='all', inplace=True)

# Keep only relevant columns (title and label)
df = df[['title', 'label']]

# Drop rows with missing values
df = df.dropna()

# Step 4: Preprocess the text (removing stopwords and tokenizing)
stop_words = set(stopwords.words('english'))

# Function to clean text
def clean_text(text):
    text = text.lower()  # Convert to lowercase
    text = ''.join([char if char.isalnum() else ' ' for char in text])  # Remove non-alphanumeric characters
    text = ' '.join([word for word in text.split() if word not in stop_words])  # Remove stopwords
    return text

df['cleaned_title'] = df['title'].apply(clean_text)

# Step 5: Text Vectorization (TF-IDF)
vectorizer = TfidfVectorizer(max_features=5000)  # Limit to top 5000 features
X = vectorizer.fit_transform(df['cleaned_title'])

# Step 6: Prepare target variable
y = df['label']

# Step 7: Split the data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Step 8: Train a machine learning model (Naive Bayes)
model = MultinomialNB()
model.fit(X_train, y_train)

# Step 9: Predict on the test data
y_pred = model.predict(X_test)

# Step 10: Evaluate the model
accuracy = accuracy_score(y_test, y_pred)
print(f"Accuracy: {accuracy * 100:.2f}%")

# Save the model and vectorizer for future use
joblib.dump(model, 'stress_detection_model.pkl')
joblib.dump(vectorizer, 'tfidf_vectorizer.pkl')
