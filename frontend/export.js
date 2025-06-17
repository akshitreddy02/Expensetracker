// // export.js
// document.addEventListener('DOMContentLoaded', () => {
//   const exportBtn = document.getElementById('export-btn');
//   if (exportBtn) {
//     exportBtn.addEventListener('click', async () => {
//       try {
//         const response = await fetch('http://localhost:8000/export/csv', {
//           method: 'GET',
//           credentials: 'include', // keep the session
//         });

//         if (!response.ok) {
//           throw new Error('Export failed');
//         }

//         const blob = await response.blob();
//         const url = window.URL.createObjectURL(blob);

//         const a = document.createElement('a');
//         a.href = url;
//         a.download = 'expenses.csv';
//         a.click();
//         window.URL.revokeObjectURL(url);
//       } catch (err) {
//         alert('Error exporting CSV: ' + err.message);
//       }
//     });
//   }
// });
