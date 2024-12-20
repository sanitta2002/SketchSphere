document.addEventListener('DOMContentLoaded', function() {
    // Signup form validation

    const signupform = document.getElementById('signupForm');// Prevent form submission
    if (signupform) {
    signupform.addEventListener('submit', (event) => {
      
        if (!validateUsername() | !validateEmail() | !validatePassword() | !validateMobile()) {
          event.preventDefault(); // Prevent form submission if validation fails
        }
      });
    }

    // User Login form validation

    const userloginform = document.getElementById("userloginForm");// Prevent form submission
    if (userloginform) { 
    userloginform.addEventListener('submit', (event) => {
    
        if (!validateEmail() | !validatePassword()) {
          event.preventDefault(); // Prevent form submission if validation fails
        }
      });
    }

   // Admin Login form validation

    const adminloginform = document.getElementById("adminloginForm");// Prevent form submission
    if (adminloginform) { 
    adminloginform.addEventListener('submit', (event) => {
    
        if (!validateEmail() | !validatePassword()) {
          event.preventDefault(); // Prevent form submission if validation fails
        }
      });
    }

    // New user form validation

    const newuserform = document.getElementById("new-userForm");// Prevent form submission
    if (newuserform) { 
      newuserform.addEventListener('submit', (event) => {

        if (!validateUsername() | !validateEmail() | !validateMobile()) {
          event.preventDefault(); // Prevent form submission if validation fails
        }
      });
    }

    // New user form validation

    const edituserform = document.getElementById("edit-userForm");// Prevent form submission
    if (edituserform) { 
      edituserform.addEventListener('submit', (event) => {

        if (!validateUsername() | !validateEmail() | !validateMobile()) {
          event.preventDefault(); // Prevent form submission if validation fails
        }
      });
    }
});



      function validateUsername(){
      let isValid = true;
      
        let username = document.getElementById('name');
        let usernameError = document.getElementById('usernameError');
        usernameError.textContent = "";
        //Username validation
        if (username.value.trim() === "") {
           usernameError.textContent = "Username is required.";
           isValid = false;
         }else if (username.value.trim().length < 3) {
           usernameError.textContent = "Username must be at least 3 characters.";
           isValid = false;
        }
        return isValid;
      }
    
      function validateEmail(){
        let isValid = true;
        const emailPattern = /^([a-z0-9_\.\-])+@([a-z0-9_\.\-])+\.([a-z]{2,4})$/;
        let email = document.getElementById('email');
        let emailError = document.getElementById('emailError');
        emailError.textContent = "";

        // Email validation
        if (email.value.trim() === "") {
          emailError.textContent = "Email is required.";
          isValid = false;
        } else if (!emailPattern.test(email.value)) {
          emailError.textContent = "E-mail is not in the correct format.";
          isValid = false;
        }
        return isValid;
      }
    
      function validatePassword(){
        let isValid = true;
        let password = document.getElementById('password');
        let passwordError = document.getElementById('passwordError');
        passwordError.textContent = "";
        
        // Password validation
        if (password.value.trim() === "") {
          passwordError.textContent = "Password is required.";
          isValid = false;
        } else if (password.value.trim().length < 6) {
          passwordError.textContent = "Password must be at least 6 characters.";
          isValid = false;
        }
        return isValid;
      }
    
      function validateMobile(){
        let isValid = true;
        const mobilePattern = /^[0-9]{10}$/; // Simple mobile number validation (10 digits)
        let mobile = document.getElementById('mobile');
        let mobileError = document.getElementById('mobileError');
        mobileError.textContent = "";
        // Mobile validation
        if (mobile.value.trim() === "") {
          mobileError.textContent = "Mobile number is required.";
          isValid = false;
        } else if (!mobilePattern.test(mobile.value)) {
          mobileError.textContent = "Enter a valid 10-digit mobile number.";
          isValid = false;
        }
        return isValid;
      }

      function showConfirmDialog(userId) {
          // Show the confirmation dialog
          const confirmDialog = document.getElementById('confirmDialog');
          confirmDialog.style.display = 'block';
      
          // Get the "Confirm" button and set the delete link dynamically
          const confirmBtn = document.getElementById('confirmBtn');
          confirmBtn.onclick = function() {
              // Redirect to the delete route if confirmed
              window.location.href = '/admin/delete-user?id=' + userId;
          };
        
          // Get the "Cancel" button and hide the dialog when clicked
          const cancelBtn = document.getElementById('cancelBtn');
          cancelBtn.onclick = function() {
              confirmDialog.style.display = 'none'; // Hide the dialog
          };
      }