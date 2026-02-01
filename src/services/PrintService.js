import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates a PDF from a specific DOM element.
 * @param {HTMLElement} elementId - The DOM element ID to render.
 * @param {string} fileName - The output filename (e.g., 'Grade1_Schedule').
 * @param {string} title - Optional title to add to the PDF.
 */
export const generatePDF = async (element, fileName, title) => {
    if (!element) {
        console.error('Element not found for PDF generation');
        return;
    }

    try {
        // Create canvas from the element
        const canvas = await html2canvas(element, {
            scale: 2, // Higher scale for better resolution
            useCORS: true, // Allow loading images from other domains if needed
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');

        // PDF dimensions (A4)
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Calculate image dimensions to fit A4 width
        const imgWidth = pdfWidth - 20; // 10mm margin each side
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let position = 10; // Start Y position

        if (title) {
            pdf.setFontSize(16);
            // Note: Default fonts don't support Chinese. 
            // Since we are capturing the whole view as an image, the title inside the view is best.
            // If we add title here using standard fonts, it won't show Chinese correctly.
            // So we rely on the HTML view to have the title.
        }

        // Check if image height exceeds page height
        if (imgHeight > pdfHeight - 20) {
            // Multi-page handling (simple cut) or just shrink?
            // For schedules, shrinking to fit one page is usually preferred.
            // But if it's too long, we might need to handle paging.
            // For now, let's scale to fit if it's too tall (landscape might be better for schedules).

            // Switch to landscape if wide
            if (canvas.width > canvas.height) {
                pdf.deletePage(1);
                pdf.addPage('a4', 'l');
                // Recalculate for landscape
                const lsWidth = pdf.internal.pageSize.getWidth();
                const lsImgWidth = lsWidth - 20;
                const lsImgHeight = (canvas.height * lsImgWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 10, 10, lsImgWidth, lsImgHeight);
            } else {
                pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            }
        } else {
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        }

        pdf.save(`${fileName}.pdf`);

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('PDF 生成失敗: ' + error.message);
    }
};

/**
 * Batch generator can simply call generatePDF in a loop,
 * provided the UI renders the views sequentially or all at once.
 */
