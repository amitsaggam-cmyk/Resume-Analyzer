import axios from 'axios';

const API_URL = 'https://resume-analyzer-qh4k.onrender.com';

export const uploadResume = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_URL}/upload-resume`, formData);
  return response.data;
};

// WITH userId header
export const analyzeResume = async (resumeId, jobDescription, userId) => {
  const response = await axios.post(`${API_URL}/analyze`, {
    resume_id: resumeId,
    job_description: jobDescription,
  }, {
    headers: { 'User-Id': userId } // Send to backend
  });
  return response.data;
};

// WITH userId header
export const getHistory = async (userId) => {
  const response = await axios.get(`${API_URL}/history`, {
    headers: { 'User-Id': userId } // Send to backend
  });
  return response.data;
};

export const getAnalysisDetail = async (id) => {
  const response = await axios.get(`${API_URL}/analysis/${id}`);
  return response.data;
};

export const generateCoverLetter = async (resumeId, jobDescription) => {
  const response = await axios.post(`${API_URL}/cover-letter`, {
    resume_id: resumeId,
    job_description: jobDescription,
  });
  return response.data;
};