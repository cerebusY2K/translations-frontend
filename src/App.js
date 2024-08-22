import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import _ from 'lodash';
import {
  Container,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  InputAdornment,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Select,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Edit, Delete, Search, Add } from '@mui/icons-material';
import { styled } from '@mui/system';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const StyledTableCell = styled(TableCell)({
  fontSize: '14px',
  fontWeight: 'bold',
  padding: '8px 12px',
  borderBottom: '2px solid #ddd',
  cursor: 'pointer',
});

const StyledTableRow = styled(TableRow)({
  '&:nth-of-type(odd)': {
    backgroundColor: '#f9f9f9',
  },
  '&:hover': {
    backgroundColor: '#f1f1f1',
  },
});

const availableTags = ["android", "ios", "flutter", "kiosk-old", "kiosk-new", "online", "branch"];

// const serverUrl = "http://localhost:3030/"
const serverUrl = "https://translations-system.onrender.com/"

function App() {
  const [translations, setTranslations] = useState([]);
  const [filteredTranslations, setFilteredTranslations] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newTranslation, setNewTranslation] = useState({ key: '', english: '', arabic: '', tags: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [englishJson, setEnglishJson] = useState('');
  const [arabicJson, setArabicJson] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [message, setMessage] = useState('');
  const [openBulkUpload, setOpenBulkUpload] = useState(false); // State to control bulk upload modal
  const [openAddTranslation, setOpenAddTranslation] = useState(false); // State to control add translation modal
  const [existingTranslation, setExistingTranslation] = useState(null); // State for existing translation check
  const [bulkUploadTags, setBulkUploadTags] = useState([]); // Tags for bulk upload
  const [cancelTokenSource, setCancelTokenSource] = useState(null); // State to store cancel token

  useEffect(() => {
    fetchTranslations();
  }, []);

  const fetchTranslations = async () => {
    const response = await axios.get(serverUrl+'api/translations');
    setTranslations(response.data.data);
    setFilteredTranslations(response.data.data); // Initialize filteredTranslations
  };

  const debouncedCheckEnglishTranslation = useCallback(
    _.debounce(async (english, cancelToken) => {
      try {
        const response = await axios.get(serverUrl+`api/search-english/${english}`, {
          cancelToken: cancelToken.token,
        });
        setExistingTranslation(response.data); // Set existing translation if found
        setNewTranslation({
          ...newTranslation,
          english: response.data.english,
          key: response.data.key,
          arabic: response.data.arabic,
          tags: response.data.tags,
        });
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log('Previous request canceled', error.message);
        } else {
          setExistingTranslation(null); // Reset if no existing translation found
        }
      }
    }, 1000), // Adjust the debounce delay as needed
    [newTranslation]
  );

  const saveTranslation = async (key) => {
    const originalTranslation = translations.find((item) => item.key === key);

    // Check if any changes were made
    if (
      originalTranslation.english === editing.english &&
      originalTranslation.arabic === editing.arabic &&
      JSON.stringify(originalTranslation.tags) === JSON.stringify(editing.tags)
    ) {
      // No changes were made, so do not call the API or update the version
      setEditing(null);
      return;
    }

    // If changes were made, proceed with the API call
    await axios.put(serverUrl+`api/translation/${key}`, editing);
    fetchTranslations();
    setEditing(null);
    toast.success("Translation updated successfully!");  // Show success toast
  };

  const deleteTranslation = async (key) => {
    await axios.delete(serverUrl+`api/translation/${key}`);
    fetchTranslations();
  };

  const addNewTranslation = async () => {
    await axios.put(serverUrl+`api/translation/${newTranslation.key}`, newTranslation);
    fetchTranslations();
    setNewTranslation({ key: '', english: '', arabic: '', tags: [] });
    setExistingTranslation(null); // Reset existing translation state after saving
    setOpenAddTranslation(false); // Close dialog on success
    toast.success("Translation added successfully!");  // Show success toast
  };

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchTerm(value);
    const filtered = translations.filter(
      (translation) =>
        translation.key.toLowerCase().includes(value) ||
        translation.english.toLowerCase().includes(value) ||
        translation.arabic.toLowerCase().includes(value)
    );
    setFilteredTranslations(filtered);
  };

  const handleDoubleClick = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  };

  const handleJsonUpload = async () => {
    if (!englishJson || !arabicJson) {
      setMessage('Both English and Arabic JSON data must be provided.');
      return;
    }

    try {
      const response = await axios.post(serverUrl+'api/bulk-update', {
        englishJson: JSON.parse(englishJson),
        arabicJson: JSON.parse(arabicJson),
        tags: bulkUploadTags, // Include selected tags in the request
      });
      setMessage(response.data.message);
      fetchTranslations();
      setOpenBulkUpload(false); // Close dialog on success
      toast.success("Bulk upload successful!");  // Show success toast
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to upload JSON data.');
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (files.length !== 2) {
      setMessage('Please upload both English and Arabic JSON files.');
      return;
    }

    const formData = new FormData();
    formData.append('englishJson', files[0]);
    formData.append('arabicJson', files[1]);

    try {
      const response = await axios.post(serverUrl+'api/upload-json', formData, {
        params: { tags: bulkUploadTags }, // Pass tags as query parameters
      });
      setMessage(response.data.message);
      fetchTranslations();
      setOpenBulkUpload(false); // Close dialog on success
      toast.success("Bulk upload successful!");  // Show success toast
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to upload JSON files.');
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      setMessage('Please upload an Excel file.');
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', excelFile);

    try {
      const response = await axios.post(serverUrl+'api/upload-excel', formData, {
        params: { tags: bulkUploadTags }, // Pass tags as query parameters
      });
      setMessage(response.data.message);
      fetchTranslations();
      setOpenBulkUpload(false); // Close dialog on success
      toast.success("Bulk upload successful!");  // Show success toast
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to upload Excel file.');
    }
  };

  const handleOpenBulkUpload = () => {
    setOpenBulkUpload(true);
  };

  const handleCloseBulkUpload = () => {
    setOpenBulkUpload(false);
  };

  const handleOpenAddTranslation = () => {
    setOpenAddTranslation(true);
  };

  const handleCloseAddTranslation = () => {
    setOpenAddTranslation(false);
  };

  const handleTagChange = (event) => {
    const {
      target: { value },
    } = event;
    setNewTranslation({
      ...newTranslation,
      tags: typeof value === 'string' ? value.split(',') : value,
    });
  };

  const handleBulkUploadTagChange = (event) => {
    const {
      target: { value },
    } = event;
    setBulkUploadTags(typeof value === 'string' ? value.split(',') : value);
  };

  const handleEditTagChange = (event) => {
    const {
      target: { value },
    } = event;
    setEditing({
      ...editing,
      tags: typeof value === 'string' ? value.split(',') : value,
    });
  };

  const handleEnglishChange = (e) => {
    const english = e.target.value;

    // Cancel the previous request if it exists
    if (cancelTokenSource) {
      cancelTokenSource.cancel('Operation canceled due to new request.');
    }

    const newCancelToken = axios.CancelToken.source();
    setCancelTokenSource(newCancelToken);

    if (!existingTranslation || existingTranslation.english !== english) {
      // Reset all fields if the English text no longer matches the existing translation
      setNewTranslation({ key: '', english, arabic: '', tags: [] });
      setExistingTranslation(null);
    } else {
      setNewTranslation({ ...newTranslation, english });
    }

    debouncedCheckEnglishTranslation(english, newCancelToken); // Pass the cancel token to the debounced function
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Translation Management
      </Typography>

      {/* Toast container to show messages */}
      <ToastContainer />

      {/* Add Translation Button */}
      <Button
        variant="contained"
        color="primary"
        startIcon={<Add />}
        onClick={handleOpenAddTranslation}
        style={{ marginBottom: '16px' }}
      >
        Add Translation
      </Button>

      {/* Bulk Upload Button */}
      <Button
        variant="outlined"
        color="secondary"
        onClick={handleOpenBulkUpload}
        style={{ marginLeft: '16px', marginBottom: '16px' }}
      >
        Bulk Upload
      </Button>

      {/* Search Bar */}
      <TextField
        label="Search"
        value={searchTerm}
        onChange={handleSearch}
        fullWidth
        margin="normal"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />

      {/* Translation List */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <StyledTableCell>Key</StyledTableCell>
              <StyledTableCell>English</StyledTableCell>
              <StyledTableCell>Arabic</StyledTableCell>
              <StyledTableCell>Tags</StyledTableCell>
              <StyledTableCell align="right">Actions</StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTranslations.map((translation) => (
              <StyledTableRow key={translation.key}>
                <StyledTableCell onDoubleClick={() => handleDoubleClick(translation.key)}>
                  {translation.key}
                </StyledTableCell>
                <StyledTableCell onDoubleClick={() => handleDoubleClick(translation.english)}>
                  {editing && editing.key === translation.key ? (
                    <TextField
                      value={editing.english}
                      onChange={(e) => setEditing({ ...editing, english: e.target.value, arabic: '' })}
                      fullWidth
                      variant="outlined"
                      size="small"
                    />
                  ) : (
                    translation.english
                  )}
                </StyledTableCell>
                <StyledTableCell onDoubleClick={() => handleDoubleClick(translation.arabic)}>
                  {editing && editing.key === translation.key ? (
                    <TextField
                      value={editing.arabic}
                      onChange={(e) => setEditing({ ...editing, arabic: e.target.value })}
                      fullWidth
                      variant="outlined"
                      size="small"
                    />
                  ) : (
                    translation.arabic
                  )}
                </StyledTableCell>
                <StyledTableCell>
                  {editing && editing.key === translation.key ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>Tags</InputLabel>
                      <Select
                        multiple
                        value={editing.tags}
                        onChange={handleEditTagChange}
                        renderValue={(selected) => (
                          <div>
                            {selected.map((value) => (
                              <Chip key={value} label={value} />
                            ))}
                          </div>
                        )}
                      >
                        {availableTags.map((tag) => (
                          <MenuItem key={tag} value={tag}>
                            {tag}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    translation.tags.join(', ')
                  )}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {editing && editing.key === translation.key ? (
                    <Button variant="contained" color="primary" size="small" onClick={() => saveTranslation(translation.key)}>
                      Save
                    </Button>
                  ) : (
                    <>
                      <IconButton size="small" onClick={() => setEditing(translation)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteTranslation(translation.key)}>
                        <Delete />
                      </IconButton>
                    </>
                  )}
                </StyledTableCell>
              </StyledTableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Translation Dialog */}
      <Dialog open={openAddTranslation} onClose={handleCloseAddTranslation} maxWidth="md" fullWidth>
        <DialogTitle>Add New Translation</DialogTitle>
        <DialogContent>
          <TextField
            label="English"
            value={newTranslation.english}
            onChange={handleEnglishChange}
            fullWidth
            margin="normal"
          />
          {existingTranslation ? (
            <>
              <TextField
                label="Key"
                value={newTranslation.key}
                fullWidth
                margin="normal"
                InputProps={{
                  readOnly: true,
                  onDoubleClick: () => handleDoubleClick(newTranslation.key),
                }}
              />
              <TextField
                label="Arabic"
                value={newTranslation.arabic}
                fullWidth
                margin="normal"
                InputProps={{
                  readOnly: true,
                  onDoubleClick: () => handleDoubleClick(newTranslation.arabic),
                }}
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Tags</InputLabel>
                <Select
                  multiple
                  value={newTranslation.tags}
                  onChange={handleTagChange}
                  renderValue={(selected) => (
                    <div>
                      {selected.map((value) => (
                        <Chip key={value} label={value} />
                      ))}
                    </div>
                  )}
                >
                  {availableTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          ) : (
            <>
              <TextField
                label="Key"
                value={newTranslation.key}
                onChange={(e) => setNewTranslation({ ...newTranslation, key: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Arabic"
                value={newTranslation.arabic}
                onChange={(e) => setNewTranslation({ ...newTranslation, arabic: e.target.value })}
                fullWidth
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Tags</InputLabel>
                <Select
                  multiple
                  value={newTranslation.tags}
                  onChange={handleTagChange}
                  renderValue={(selected) => (
                    <div>
                      {selected.map((value) => (
                        <Chip key={value} label={value} />
                      ))}
                    </div>
                  )}
                >
                  {availableTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddTranslation} color="secondary">
            Cancel
          </Button>
          <Button onClick={addNewTranslation} color="primary">
            {existingTranslation ? 'Update Tags' : 'Add Translation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={openBulkUpload} onClose={handleCloseBulkUpload} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Upload Translations</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You can upload translations in bulk by pasting JSON data, uploading JSON files, or uploading an Excel file.
          </DialogContentText>

          <FormControl fullWidth margin="normal">
            <InputLabel>Select Tags</InputLabel>
            <Select
              multiple
              value={bulkUploadTags}
              onChange={handleBulkUploadTagChange}
              renderValue={(selected) => (
                <div>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </div>
              )}
            >
              {availableTags.map((tag) => (
                <MenuItem key={tag} value={tag}>
                  {tag}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="subtitle1" style={{ marginTop: '16px' }}>Paste JSON Data</Typography>
          <TextField
            label="English JSON"
            value={englishJson}
            onChange={(e) => setEnglishJson(e.target.value)}
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            style={{ marginBottom: '16px' }}
          />
          <TextField
            label="Arabic JSON"
            value={arabicJson}
            onChange={(e) => setArabicJson(e.target.value)}
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            style={{ marginBottom: '16px' }}
          />
          <Button variant="contained" color="primary" onClick={handleJsonUpload} style={{ marginBottom: '16px' }}>
            Upload JSON Data
          </Button>

          <Typography variant="subtitle1">Upload JSON Files</Typography>
          <input type="file" onChange={handleFileUpload} multiple style={{ marginBottom: '16px' }} />

          <Typography variant="subtitle1">Upload Excel File</Typography>
          <input type="file" onChange={(e) => setExcelFile(e.target.files[0])} style={{ marginBottom: '16px' }} />
          <Button variant="contained" color="primary" onClick={handleExcelUpload} style={{ marginBottom: '16px' }}>
            Upload Excel File
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulkUpload} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleJsonUpload} color="primary">
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {message && (
        <Paper style={{ padding: '16px', marginTop: '16px' }}>
          <Typography variant="body1" color="error">{message}</Typography>
        </Paper>
      )}
    </Container>
  );
}

export default App;
