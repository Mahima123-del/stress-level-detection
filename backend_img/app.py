from flask import Flask, jsonify, request
from flask_cors import CORS
import cv2
import numpy as np
from tensorflow.keras.models import load_model

app = Flask(__name__)
CORS(app)

# Load your trained model
model = load_model('model.h5')

# Load OpenCV face detector
face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')

# Labels according to your model
labels = ['Not Stressed', 'Moderately Stressed', 'Highly Stressed']

@app.route('/predict-stress-image', methods=['GET'])
def predict_stress():
    cap = cv2.VideoCapture(0)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        return jsonify({'error': 'Failed to capture image'}), 500

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4)

    if len(faces) == 0:
        return jsonify({'error': 'No face detected'}), 400

    for (x, y, w, h) in faces:
        face = frame[y:y+h, x:x+w]
        face = cv2.resize(face, (48, 48))  # Change this if your model expects different size
        face = face / 255.0
        face = np.expand_dims(face, axis=0)
        if face.shape[-1] != 3:
            face = np.expand_dims(face, axis=-1)

        prediction = model.predict(face)
        predicted_class = labels[np.argmax(prediction)]
        confidence = float(np.max(prediction))

        return jsonify({
            'emotion': predicted_class,
            'stressLevel': predicted_class,
            'confidence': confidence
        })

    return jsonify({'error': 'Face processing failed'}), 500

if __name__ == '__main__':
    app.run(debug=True)
